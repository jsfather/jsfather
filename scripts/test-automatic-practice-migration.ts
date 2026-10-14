import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
async function main() {
  config({ path: '.env.local', quiet: true });
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  const db = postgres(process.env.DATABASE_URL!, { max: 1 });
  const migration = await readFile('drizzle/0019_automatic_practice.sql', 'utf8');
  const body = migration
    .slice(migration.indexOf('-- Stop legacy timers.'))
    .replaceAll('--> statement-breakpoint', '');
  const rollback = new Error('test rollback');
  try {
    await db.begin(async (tx) => {
      const user = randomUUID(),
        book = randomUUID(),
        lesson = randomUUID(),
        legacy = randomUUID(),
        vocab = randomUUID(),
        word = randomUUID(),
        review = randomUUID(),
        exam = randomUUID(),
        attempt = randomUUID(),
        session = randomUUID();
      await tx`insert into users(id,email,username,timezone) values(${user},${user + '@example.test'},${user},'Asia/Tehran')`;
      for (const [id, kind] of [
        [book, 'book'],
        [legacy, 'book'],
        [lesson, 'standard'],
        [vocab, 'vocabulary'],
      ]) {
        await tx`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_pages,current_page,total_sessions,scheduled_time,duration,timezone,weekdays,start_date,updated_at)
        values(${id},${user},${kind},'Migration fixture',${id},'Backend','beginner',${kind === 'book' ? 200 : null},${kind === 'book' ? 10 : 0},0,'00:00',30,'Asia/Tehran','[]','2026-10-14','2026-10-14T21:00:00Z')`;
      }
      await tx`insert into course_sessions(id,course_id,title,session_number,scheduled_date,duration,status,completed_at) values(${session},${lesson},'Completed',1,now(),30,'completed','2026-10-14T21:00:00Z')`;
      await tx`insert into vocabulary_words(id,course_id,word,explanation,added_on) values(${word},${vocab},'Migration','Testing past outcomes','2026-10-14')`;
      await tx`insert into vocabulary_reviews(id,course_id,word_id,user_id,word_version,word_snapshot,direction,submitted_at) values(${review},${vocab},${word},${user},1,'{}','word','2026-10-14T21:00:00Z')`;
      await tx`insert into exams(id,course_id,title,time_limit) values(${exam},${lesson},'Migration assessment',2)`;
      await tx`insert into exam_attempts(id,exam_id,user_id,started_at,submitted_at) values(${attempt},${exam},${user},'2026-10-14T20:55:00Z','2026-10-14T21:00:00Z')`;
      await tx`insert into practice_sessions(id,user_id,course_id,activity,seconds) values(${randomUUID()},${user},${legacy},'reading',42)`;
      await tx`insert into practice_days(user_id,day,seconds) values(${user},'2026-10-15',42)`;
      await tx.unsafe(body);
      const [day] =
        await tx`select seconds from practice_days where user_id=${user} and day='2026-10-15'`;
      assert.equal(day.seconds, 3192);
      const [previous] =
        await tx`select seconds,ended_at from practice_sessions where user_id=${user} and source_key is null`;
      assert.equal(previous.seconds, 42);
      assert.ok(previous.ended_at);
      const [duplicate] =
        await tx`select seconds from practice_sessions where source_key=${'book:' + legacy + ':10'}`;
      assert.equal(duplicate.seconds, 0);
      const [mark] = await tx`select credited_pages from courses where id=${book}`;
      assert.equal(mark.credited_pages, 10);
      await tx.unsafe(body);
      const [repeated] =
        await tx`select seconds from practice_days where user_id=${user} and day='2026-10-15'`;
      assert.equal(repeated.seconds, 3192);
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  } finally {
    await db.end();
  }
  console.log(
    'Automatic-practice migration: historical credits, timezone, caps, legacy preservation, and idempotency passed.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
