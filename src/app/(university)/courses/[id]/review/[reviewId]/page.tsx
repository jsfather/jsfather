import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { accessibleVocabularyCourse, vocabularyWordReviewCounts } from '@/lib/vocabulary-data';
import { db } from '@/db';
import { vocabularyReviews, vocabularyWords, vocabularyProgress } from '@/db/schema';
import { cookies } from 'next/headers';
import { vocabularyMode } from '@/lib/vocabulary';
import { VocabularyReviewCard, VocabularyReviewMode } from '@/components/vocabulary-forms';
export const metadata = { title: 'Review a word' };
export default async function ReviewCard({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const user = await requireUser();
  const { id, reviewId } = await params;
  const course = await accessibleVocabularyCourse(user.id, id);
  const reviewCounts = vocabularyWordReviewCounts(user.id, id, reviewId);
  const [row] = await db
    .select({
      review: vocabularyReviews,
      word: vocabularyWords,
      progress: vocabularyProgress,
      reviewCounts: {
        shown: reviewCounts.shown,
        successful: reviewCounts.successful,
        failed: reviewCounts.failed,
      },
    })
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
    .leftJoin(reviewCounts, eq(reviewCounts.wordId, vocabularyWords.id))
    .where(
      and(
        eq(vocabularyReviews.id, reviewId),
        eq(vocabularyReviews.courseId, id),
        eq(vocabularyReviews.userId, user.id),
      ),
    );
  if (!row) notFound();
  if (row.review.submittedAt || course.status === 'archived') redirect(`/courses/${id}/review`);
  const mode = vocabularyMode(
    (await cookies()).get(`vocabulary-mode-${user.id}`)?.value ?? row.review.direction,
  );
  return (
    <div className="vocabulary-review-page">
      <header className="ui-stack vocabulary-review-header">
        <div className="vocabulary-review-title">
          <h1>{course.title}</h1>
          <Link className="text-link" href={`/courses/${id}`}>
            Back to course
          </Link>
        </div>
        <VocabularyReviewMode key={reviewId} courseId={id} reviewId={reviewId} mode={mode} />
      </header>
      <VocabularyReviewCard
        key={`${reviewId}-${row.review.direction}-${row.review.revealedAt?.toISOString() ?? 'hidden'}`}
        courseId={id}
        reviewId={reviewId}
        word={row.word}
        direction={row.review.direction}
        revealed={Boolean(row.review.revealedAt)}
        successfulReviews={row.progress?.successfulReviews ?? 0}
        reviewCounts={row.reviewCounts}
      />
    </div>
  );
}
