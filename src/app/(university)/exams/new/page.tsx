import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ownedCourse, ownedSession, pageNumber } from '@/lib/data';
import { db } from '@/db';
import { courses, courseSessions } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { PageTitle, Empty, Pagination } from '@/components/ui';
import { ExamBuilder } from '@/components/exam-builder';
export const metadata = { title: 'Add class questions' };
export default async function NewExam({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; session?: string; page?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  if (query.session) {
    const { session, course } = await ownedSession(user.id, query.session);
    return (
      <>
        <PageTitle
          eyebrow={course.title}
          title={'Questions · ' + session.title}
          description="Build your class question bank with easy, medium, and hard questions."
        />
        <ExamBuilder courseId={course.id} sessionId={session.id} />
      </>
    );
  }
  if (query.course) {
    const course = await ownedCourse(user.id, query.course);
    const sessions = await db
      .select()
      .from(courseSessions)
      .where(eq(courseSessions.courseId, course.id))
      .orderBy(asc(courseSessions.sessionNumber));
    return (
      <>
        <PageTitle
          eyebrow={course.title.toUpperCase()}
          title="Choose a class"
          description="Add questions to the class you studied."
        />
        <div className="course-grid full">
          {sessions.map((s) => (
            <Link className="course-card" key={s.id} href={'/exams/new?session=' + s.id}>
              <h3>
                {s.sessionNumber}. {s.title}
              </h3>
              <p className="muted">Add class questions</p>
            </Link>
          ))}
        </div>
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
                  Choose a class and add questions.
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
