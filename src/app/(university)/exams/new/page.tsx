import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ownedCourse, pageNumber } from '@/lib/data';
import { db } from '@/db';
import { courses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { PageTitle, Empty, Pagination } from '@/components/ui';
import { ExamBuilder } from '@/components/exam-builder';
export const metadata = { title: 'Create exam' };
export default async function NewExam({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; page?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  if (query.course) {
    const course = await ownedCourse(user.id, query.course);
    return (
      <>
        <PageTitle
          eyebrow={course.title.toUpperCase()}
          title="Create an exam"
          description="Build an assessment that tests what matters."
        />
        <ExamBuilder courseId={course.id} />
      </>
    );
  }
  const page = pageNumber(query.page);
  const list = await db
    .select({ id: courses.id, title: courses.title, description: courses.description })
    .from(courses)
    .where(eq(courses.ownerId, user.id))
    .orderBy(desc(courses.createdAt))
    .limit(20)
    .offset((page - 1) * 20);
  return (
    <>
      <PageTitle title="Choose a course" description="Which course would you like to assess?" />
      {list.length ? (
        <>
          <div className="course-grid full">
            {list.map((course) => (
              <Link className="course-card" key={course.id} href={'/exams/new?course=' + course.id}>
                <h3>{course.title}</h3>
                <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                  Create an exam for this course.
                </p>
              </Link>
            ))}
          </div>
          <Pagination page={page} hasMore={list.length === 20} base="/exams/new" />
        </>
      ) : (
        <Empty
          title="Start with a course."
          description="Create a course before adding an exam to your university."
          href="/courses/new"
        />
      )}
    </>
  );
}
