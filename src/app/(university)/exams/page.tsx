import Link from 'next/link';
import { Plus, ClipboardList } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { db } from '@/db';
import { courses, exams, examAttempts } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { PageTitle, Badge, Empty, Pagination } from '@/components/ui';
import { pageNumber } from '@/lib/data';
export const metadata = { title: 'Exams' };
export default async function Exams({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const page = pageNumber((await searchParams).page);
  const list = await db
    .select({
      exam: exams,
      title: courses.title,
      best: sql<number | null>`max(${examAttempts.percentage})`,
      passed: sql<boolean>`coalesce(bool_or(${examAttempts.passed}),false)`,
    })
    .from(exams)
    .innerJoin(courses, eq(exams.courseId, courses.id))
    .leftJoin(
      examAttempts,
      and(eq(exams.id, examAttempts.examId), eq(examAttempts.userId, user.id)),
    )
    .where(eq(courses.ownerId, user.id))
    .groupBy(exams.id, courses.title)
    .orderBy(desc(exams.createdAt))
    .limit(20)
    .offset((page - 1) * 20);
  return (
    <>
      <PageTitle
        eyebrow="PUT IT INTO PRACTICE"
        title="Exams"
        description="Find out what you know. Discover what to revisit."
        action={
          <Link className="button primary" href="/exams/new">
            <Plus size={16} />
            Create exam
          </Link>
        }
      />
      {list.length ? (
        <>
          {list.map(({ exam, title, best, passed }) => (
            <article className="exam-card" key={exam.id}>
              <div className="course-icon">
                <ClipboardList size={22} />
              </div>
              <div>
                <Link href={'/exams/' + exam.id}>
                  <h3>{exam.title}</h3>
                </Link>
                <p>
                  {title} · {exam.timeLimit} minutes · Pass at {exam.passingScore}%
                </p>
              </div>
              <Badge color={passed ? 'teal' : exam.published ? 'blue' : 'neutral'}>
                {passed
                  ? `Passed · ${best}%`
                  : best !== null
                    ? `Best: ${best}%`
                    : exam.published
                      ? 'Ready to take'
                      : 'Draft'}
              </Badge>
              <Link href={'/exams/' + exam.id} className="button secondary">
                Open exam
              </Link>
            </article>
          ))}
          <Pagination page={page} hasMore={list.length === 20} base="/exams" />
        </>
      ) : (
        <Empty
          title="Turn learning into understanding."
          description="Create an exam for one of your courses. Add questions, set a time limit, and challenge yourself."
          href="/exams/new"
          label="Create your first exam"
        />
      )}
    </>
  );
}
