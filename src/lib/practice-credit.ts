import 'server-only';
import { db } from '@/db';
import { practiceDays, practiceSessions } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import type { PracticeActivity } from './practice';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Called inside the learning mutation's transaction. The unique outcome key and
// atomic daily increment make retries and concurrent submissions safe.
export async function creditPractice(
  tx: Tx,
  input: {
    userId: string;
    courseId: string | null;
    timezone: string;
    sourceKey: string;
    activity: PracticeActivity;
    seconds: number;
    at?: Date;
  },
) {
  const at = input.at ?? new Date();
  const day = formatInTimeZone(at, input.timezone, 'yyyy-MM-dd');
  const seconds = Math.max(0, Math.floor(input.seconds));
  const inserted = await tx
    .insert(practiceSessions)
    .values({
      userId: input.userId,
      courseId: input.courseId,
      sourceKey: input.sourceKey,
      activity: input.activity,
      seconds,
      day,
      startedAt: at,
      lastHeartbeatAt: at,
      endedAt: at,
    })
    .onConflictDoNothing({ target: practiceSessions.sourceKey })
    .returning({ id: practiceSessions.id });
  if (!inserted.length || !seconds) return;
  await tx
    .insert(practiceDays)
    .values({ userId: input.userId, day, seconds })
    .onConflictDoUpdate({
      target: [practiceDays.userId, practiceDays.day],
      set: { seconds: sql`${practiceDays.seconds} + ${seconds}` },
    });
}
