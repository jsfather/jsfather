import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { users, pushSubscriptions } from '@/db/schema';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { pushClient, pushConfigured } from '@/lib/push';
import { vocabularyDueSummary } from '@/lib/vocabulary-data';
import { reminderDay, vocabularyReminderBody } from '@/lib/reminders';
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
  for (const { subscription, timezone } of rows) {
    const { day, eligible } = reminderDay(new Date(), timezone);
    if (!eligible || subscription.lastSentDay === day) continue;
    let summary = summaries.get(subscription.userId);
    if (!summary) {
      summary = await vocabularyDueSummary(subscription.userId);
      summaries.set(subscription.userId, summary);
    }
    const body = vocabularyReminderBody(summary.learn, summary.review);
    if (!body) continue;
    // Atomically claim this device/day so overlapping scheduler calls cannot duplicate delivery.
    const claimed = await db
      .update(pushSubscriptions)
      .set({ lastSentDay: day })
      .where(
        and(
          eq(pushSubscriptions.id, subscription.id),
          eq(pushSubscriptions.userId, subscription.userId),
          or(isNull(pushSubscriptions.lastSentDay), ne(pushSubscriptions.lastSentDay, day)),
        ),
      )
      .returning({ id: pushSubscriptions.id });
    if (!claimed.length) continue;
    try {
      await push.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ body }),
        { TTL: 3600, timeout: 10000 },
      );
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        await db
          .delete(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.id, subscription.id),
              eq(pushSubscriptions.userId, subscription.userId),
            ),
          );
      else {
        failed++;
        await db
          .update(pushSubscriptions)
          .set({ lastSentDay: subscription.lastSentDay })
          .where(
            and(
              eq(pushSubscriptions.id, subscription.id),
              eq(pushSubscriptions.userId, subscription.userId),
              eq(pushSubscriptions.lastSentDay, day),
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
