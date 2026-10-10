import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { accessibleVocabularyCourse } from '@/lib/vocabulary-data';
import { db } from '@/db';
import { vocabularyReviews, vocabularyWords, vocabularyProgress } from '@/db/schema';
import { PageTitle } from '@/components/ui';
import { VocabularyReviewCard } from '@/components/vocabulary-forms';
export const metadata = { title: 'Review a word' };
export default async function ReviewCard({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const user = await requireUser();
  const { id, reviewId } = await params;
  const course = await accessibleVocabularyCourse(user.id, id);
  const [row] = await db
    .select({ review: vocabularyReviews, word: vocabularyWords, progress: vocabularyProgress })
    .from(vocabularyReviews)
    .innerJoin(
      vocabularyWords,
      and(eq(vocabularyWords.id, vocabularyReviews.wordId), eq(vocabularyWords.courseId, id)),
    )
    .leftJoin(
      vocabularyProgress,
      and(
        eq(vocabularyProgress.wordId, vocabularyWords.id),
        eq(vocabularyProgress.userId, user.id),
      ),
    )
    .where(
      and(
        eq(vocabularyReviews.id, reviewId),
        eq(vocabularyReviews.courseId, id),
        eq(vocabularyReviews.userId, user.id),
      ),
    );
  if (!row) notFound();
  if (row.review.submittedAt || course.status === 'archived') redirect(`/courses/${id}/review`);
  return (
    <>
      <PageTitle
        eyebrow="VOCABULARY PRACTICE"
        title={course.title}
        description="Try to recall the answer, then reveal it and rate your memory."
      />
      <VocabularyReviewCard
        key={reviewId}
        courseId={id}
        reviewId={reviewId}
        word={row.word}
        direction={row.review.direction}
        revealed={Boolean(row.review.revealedAt)}
        successfulReviews={row.progress?.successfulReviews ?? 0}
      />
      <Link className="text-link" href={`/courses/${id}`} style={{ marginTop: 24 }}>
        Back to course
      </Link>
    </>
  );
}
