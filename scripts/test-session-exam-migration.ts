import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';

async function main() {
  // Always provisions its own disposable database; never reads DATABASE_URL.
  const dir = await mkdtemp(join(tmpdir(), 'jsfather-exam-migration-'));
  const port = 55000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'tester',
    password: 'disposable-test',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  let client: ReturnType<typeof postgres> | undefined;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('exam_migration');
    client = postgres(`postgresql://tester:disposable-test@127.0.0.1:${port}/exam_migration`, {
      max: 1,
    });
    const db = client;
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
    async function apply(tag: string) {
      const migration = await readFile(`drizzle/${tag}.sql`, 'utf8');
      await db.begin(async (tx) => {
        for (const statement of migration.split('--> statement-breakpoint'))
          if (statement.trim()) await tx.unsafe(statement);
      });
    }
    for (const entry of journal.entries.filter((e: { idx: number }) => e.idx < 7))
      await apply(entry.tag);
    await db`insert into users (id, email, username) values ('u', 'migration@example.test', 'migration-tester')`;
    await db`insert into courses (id, owner_id, title, slug, category, difficulty, total_sessions, scheduled_time, duration, timezone, weekdays, start_date)
    values ('c', 'u', 'Course', 'course', 'Testing', 'beginner', 1, '09:00', 60, 'UTC', '[1]', '2026-10-01')`;
    await db`insert into course_sessions (id, course_id, title, session_number, scheduled_date, duration)
    values ('s', 'c', 'First session', 1, now(), 60)`;
    await db`insert into exams (id, course_id, session_id, title, created_at, auto_time_limit, auto_passing_score, time_limit)
    values ('e1', 'c', 's', 'Duplicate name', '2026-10-01', true, true, 1),
           ('e2', 'c', 's', 'Duplicate name', '2026-10-02', false, false, 2)`;
    await db`insert into exam_questions (id, exam_id, question, type, difficulty, time_seconds, points, "order")
    values ('q1', 'e1', 'First?', 'true_false', 'easy', 60, 1, 0),
           ('q2', 'e2', 'Second?', 'true_false', 'hard', 180, 3, 0)`;
    await db`insert into exam_options (id, question_id, text, is_correct, "order")
    values ('o1', 'q1', 'True', true, 0), ('o2', 'q2', 'False', true, 0)`;
    await db`insert into exam_attempts (id, exam_id, user_id) values ('a1', 'e1', 'u'), ('a2', 'e2', 'u')`;
    await assert.rejects(
      () => apply('0007_single_session_exam'),
      /Finish overlapping active attempts/,
    );
    assert.equal((await db`select * from exams`).length, 2);
    await db`update exam_attempts set submitted_at = now(), score = 1, percentage = 100 where id = 'a1'`;
    await apply('0007_single_session_exam');
    const [exam] = await db`select * from exams`;
    assert.equal(exam.id, 'e1');
    assert.equal(exam.title, 'First session · Questions');
    assert.equal(exam.time_limit, 4);
    assert.equal(exam.passing_score, 65);
    const questions = await db`select * from exam_questions order by "order"`;
    assert.deepEqual(
      questions.map((q) => [q.id, q.exam_id, q.order]),
      [
        ['q1', 'e1', 0],
        ['q2', 'e1', 1],
      ],
    );
    assert.equal((await db`select * from exam_options`).length, 2);
    const [active] = await db`select * from exam_attempts where id = 'a2'`;
    assert.equal(active.exam_id, 'e1');
    assert.equal(active.snapshot.timeLimit, 2);
    assert.deepEqual(
      active.snapshot.questions.map((q: { id: string }) => q.id),
      ['q2'],
    );
    assert.equal(active.snapshot.questions[0].options[0].id, 'o2');
    assert.equal((await db`select * from exam_attempts where id = 'a1'`)[0].percentage, 100);
    await assert.rejects(
      () =>
        db`insert into exams (id, course_id, session_id, title) values ('e3', 'c', 's', 'Duplicate')`,
    );
    await db`insert into exams (id, course_id, title, is_final) values ('f1', 'c', 'Final 1', true), ('f2', 'c', 'Final 2', true)`;
    await assert.rejects(() => db`update exams set session_id = 's' where id = 'f1'`);
    console.log(
      'PASS: Migration preserves questions, options, results and active snapshots; blocks overlapping attempts; enforces one exam per session while allowing course finals.',
    );
  } finally {
    if (client) await client.end();
    await pg.stop();
    await rm(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
