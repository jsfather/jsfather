import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ownedCourse, ownedSession, ownedCategoryBank, pageNumber } from '@/lib/data';
import { db } from '@/db';
import { courses, courseSessions, exams } from '@/db/schema';
import { eq, desc, asc, and } from 'drizzle-orm';
import { PageTitle, Empty, Pagination } from '@/components/ui';
import { ExamBuilder } from '@/components/exam-builder';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Add questions' };
export default async function NewExam({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; session?: string; category?: string; page?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  if (query.category) {
    const categoryBank = await ownedCategoryBank(user.id, query.category);
    const [existing] = await db
      .select({ id: exams.id })
      .from(exams)
      .where(
        and(
          eq(exams.categoryBankId, categoryBank.id),
          eq(exams.isFinal, false),
          eq(exams.isPractice, false),
        ),
      );
    if (existing) redirect('/exams/' + existing.id + '/edit');
    return (
      <>
        <PageTitle
          eyebrow={categoryBank.category}
          title="Add category questions"
          description="Add questions directly to this category. Category exams also include questions from its courses."
        />
        <ExamBuilder categoryBankId={categoryBank.id} />
      </>
    );
  }
  if (query.session) {
    const { session, course } = await ownedSession(user.id, query.session);
    const [existing] = await db
      .select({ id: exams.id })
      .from(exams)
      .where(eq(exams.sessionId, session.id))
      .limit(1);
    if (existing) redirect('/exams/' + existing.id + '/edit');
    return (
      <>
        <PageTitle
          eyebrow={course.title}
          title={'Questions · ' + session.title}
          description={
            course.kind === 'book'
              ? 'Build your book’s question bank as you read.'
              : 'Build your class question bank with easy, medium, and hard questions.'
          }
        />
        <ExamBuilder courseId={course.id} sessionId={session.id} book={course.kind === 'book'} />
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
    if (course.kind === 'book' && sessions[0]) redirect('/exams/new?session=' + sessions[0].id);
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
