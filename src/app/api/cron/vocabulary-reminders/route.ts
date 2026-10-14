import { DAILY_GOAL_SECONDS } from '@/lib/practice';
import { fromZonedTime } from 'date-fns-tz';
import { addDays, format, parseISO } from 'date-fns';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { users, pushSubscriptions, practiceDays, courses } from '@/db/schema';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { pushClient, pushConfigured } from '@/lib/push';
import { vocabularyDueSummary } from '@/lib/vocabulary-data';
import { reminderDay, vocabularyReminderBody, streakReminder } from '@/lib/reminders';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const supplied = request.headers.get('authorization') ?? '';
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (
    !process.env.CRON_SECRET ||
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  )
    return new Response(null, { status: 401 });
  if (!pushConfigured()) return new Response(null, { status: 503 });
  const push = pushClient();
  const rows = await db
    .select({ subscription: pushSubscriptions, timezone: users.timezone })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId));
  let sent = 0,
    failed = 0;
  const summaries = new Map<string, Awaited<ReturnType<typeof vocabularyDueSummary>>>();
  const now = new Date();
  for (const { subscription, timezone } of rows) {
    const { day, eligible } = reminderDay(now, timezone);
    const tasks: {
      field: 'lastSentDay' | 'lastStreakDay';
      body: string;
      title: string;
      tag: string;
      url: string;
    }[] = [];
    if (eligible && subscription.lastSentDay !== day) {
      let summary = summaries.get(subscription.userId);
      if (!summary) {
        summary = await vocabularyDueSummary(subscription.userId);
        summaries.set(subscription.userId, summary);
      }
      const body = vocabularyReminderBody(summary.learn, summary.review);
      if (body)
        tasks.push({
          field: 'lastSentDay',
          body,
          title: 'Time for your vocabulary',
          tag: 'vocabulary-daily',
          url: '/courses',
        });
    }
    if (subscription.lastStreakDay !== day) {
      const [practice] = await db
        .select({ seconds: practiceDays.seconds })
        .from(practiceDays)
        .where(and(eq(practiceDays.userId, subscription.userId), eq(practiceDays.day, day)));
      const reminder = streakReminder(now, timezone, practice?.seconds ?? 0);
      if (reminder.eligible) {
        const [available] = await db
          .select({ id: courses.id })
          .from(courses)
          .where(
            and(
              eq(courses.status, 'active'),
              sql`(${courses.ownerId} = ${subscription.userId} or (${courses.kind} = 'vocabulary' and exists (select 1 from vocabulary_members m where m.course_id = ${courses.id} and m.user_id = ${subscription.userId})))`,
            ),
          )
          .limit(1);
        if (available)
          tasks.push({
            field: 'lastStreakDay',
            body: reminder.body,
            title: 'There’s still time for your daily goal',
            tag: 'practice-streak',
            url: '/dashboard',
          });
      }
    }
    for (const task of tasks) {
      const column = pushSubscriptions[task.field];
      // Claim each notification type independently; recheck the goal at the claim boundary.
      const claimed = await db
        .update(pushSubscriptions)
        .set({ [task.field]: day })
        .where(
          and(
            eq(pushSubscriptions.id, subscription.id),
            eq(pushSubscriptions.userId, subscription.userId),
            or(isNull(column), ne(column, day)),
            task.field === 'lastStreakDay'
              ? sql`not exists (select 1 from practice_days p where p.user_id = ${subscription.userId} and p.day = ${day} and p.seconds >= ${DAILY_GOAL_SECONDS})`
              : undefined,
          ),
        )
        .returning({ id: pushSubscriptions.id });
      if (!claimed.length) continue;
      const midnight = fromZonedTime(
        format(addDays(parseISO(day), 1), 'yyyy-MM-dd') + 'T00:00:00',
        timezone,
      );
      try {
        await push.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({ body: task.body, title: task.title, tag: task.tag, url: task.url }),
          {
            TTL: Math.max(
              1,
              Math.min(3600, Math.floor((midnight.getTime() - now.getTime()) / 1000)),
            ),
            timeout: 10000,
          },
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(
              and(
                eq(pushSubscriptions.id, subscription.id),
                eq(pushSubscriptions.userId, subscription.userId),
              ),
            );
          break;
        }
        failed++;
        await db
          .update(pushSubscriptions)
          .set({ [task.field]: subscription[task.field] })
          .where(
            and(
              eq(pushSubscriptions.id, subscription.id),
              eq(pushSubscriptions.userId, subscription.userId),
              eq(column, day),
            ),
          );
      }
    }
  }
  return Response.json(
    { sent, failed },
    { status: failed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
