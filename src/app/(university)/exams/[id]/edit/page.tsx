import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ownedExam } from '@/lib/data';
import { db } from '@/db';
import { examQuestions, examOptions, examAttempts, courseSessions } from '@/db/schema';
import { eq, asc, inArray, and, sql } from 'drizzle-orm';
import { PageTitle } from '@/components/ui';
import { ExamBuilder } from '@/components/exam-builder';
export const metadata = { title: 'Edit class questions' };
export default async function EditExam({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { exam, course } = await ownedExam(user.id, (await params).id);
  if (exam.isFinal)
    return (
      <PageTitle
        title="This assessment is a fixed snapshot"
        description="Edit the question bank on each class and generate another final."
      />
    );
  const sessions = await db
    .select({ id: courseSessions.id, title: courseSessions.title })
    .from(courseSessions)
    .where(eq(courseSessions.courseId, course.id))
    .orderBy(asc(courseSessions.sessionNumber));
  const [attempt] = await db
    .select({ id: examAttempts.id })
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.examId, exam.id),
        sql`${examAttempts.submittedAt} is null`,
        sql`${examAttempts.snapshot} is null`,
      ),
    )
    .limit(1);
  if (attempt)
    return (
      <>
        <PageTitle
          title="This exam is locked"
          description="Finish the older active attempt before editing. New attempts keep their own question snapshots."
        />
        <Link className="button primary" href={'/exams/new?course=' + course.id}>
          Add class questions
        </Link>
      </>
    );
  const questions = await db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, exam.id))
    .orderBy(asc(examQuestions.order));
  const options = questions.length
    ? await db
        .select()
        .from(examOptions)
        .where(
          inArray(
            examOptions.questionId,
            questions.map((q) => q.id),
          ),
        )
        .orderBy(asc(examOptions.order))
    : [];
  return (
    <>
      <PageTitle eyebrow={course.title.toUpperCase()} title="Edit class questions" />
      <ExamBuilder
        courseId={course.id}
        sessionId={exam.sessionId ?? ''}
        sessions={sessions}
        examId={exam.id}
        initial={{
          passingScore: exam.autoPassingScore ? null : exam.passingScore,
          timeLimit: exam.autoTimeLimit ? null : exam.timeLimit,
          published: exam.isPublic,
          questions: questions.map((q) => ({
            question: q.question,
            difficulty: q.difficulty,
            type: q.type,
            points: q.points,
            timeSeconds: q.timeSeconds,
            acceptedAnswers: q.acceptedAnswers,
            caseSensitive: q.caseSensitive,
            tolerance: q.tolerance,
            pairs: q.pairs,
            explanation: q.explanation,
            options: options
              .filter((o) => o.questionId === q.id)
              .map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          })),
        }}
      />
    </>
  );
}
