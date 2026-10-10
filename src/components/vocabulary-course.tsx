import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@/db';
import {
  users,
  vocabularyMembers,
  vocabularyWords,
  vocabularyProgress,
  vocabularyReviews,
  type Course,
  type User,
} from '@/db/schema';
import { vocabularyStats } from '@/lib/vocabulary-data';
import { reviewTargets } from '@/lib/vocabulary';
import { startVocabularyReview } from '@/actions/vocabulary';
import { PageTitle, Badge, Progress, Pagination } from './ui';
import { Submit } from './forms';
import {
  LeaveVocabularyCourseForm,
  VocabularyWordForm,
  DeleteVocabularyWordForm,
  AddVocabularyCollaboratorForm,
  RemoveVocabularyCollaboratorForm,
} from './vocabulary-forms';

export async function VocabularyCourseDetail({
  course,
  user,
  page,
}: {
  course: Course;
  user: User;
  page: number;
}) {
  const owner = course.ownerId === user.id;
  const [stats, words, members, history] = await Promise.all([
    vocabularyStats(course.id, user.id),
    db
      .select({ word: vocabularyWords, progress: vocabularyProgress })
      .from(vocabularyWords)
      .leftJoin(
        vocabularyProgress,
        and(
          eq(vocabularyProgress.wordId, vocabularyWords.id),
          eq(vocabularyProgress.userId, user.id),
        ),
      )
      .where(eq(vocabularyWords.courseId, course.id))
      .orderBy(
        desc(vocabularyWords.addedOn),
        desc(vocabularyWords.createdAt),
        desc(vocabularyWords.id),
      )
      .limit(50)
      .offset((page - 1) * 50),
    owner
      ? db
          .select({ id: users.id, name: users.name, username: users.username })
          .from(vocabularyMembers)
          .innerJoin(users, eq(users.id, vocabularyMembers.userId))
          .where(eq(vocabularyMembers.courseId, course.id))
          .orderBy(users.username)
      : Promise.resolve([]),
    db
      .select({
        snapshot: vocabularyReviews.wordSnapshot,
        remembered: vocabularyReviews.remembered,
        date: vocabularyReviews.submittedAt,
      })
      .from(vocabularyReviews)
      .innerJoin(vocabularyWords, eq(vocabularyWords.id, vocabularyReviews.wordId))
      .where(
        and(
          eq(vocabularyReviews.courseId, course.id),
          eq(vocabularyReviews.userId, user.id),
          sql`${vocabularyReviews.submittedAt} is not null`,
        ),
      )
      .orderBy(desc(vocabularyReviews.submittedAt))
      .limit(10),
  ]);
  const today = formatInTimeZone(new Date(), course.timezone, 'yyyy-MM-dd');
  return (
    <>
      <PageTitle
        eyebrow="LANGUAGE VOCABULARY"
        title={course.title}
        description={
          course.description || `Build your ${course.category} vocabulary, a few words each day.`
        }
        action={
          owner ? (
            <Link className="button secondary" href={`/courses/${course.id}/edit`}>
              Edit course
            </Link>
          ) : (
            <Badge>Collaborator</Badge>
          )
        }
      />
      <div className="stats-grid vocabulary-stats">
        {[
          { label: 'Words', value: stats.total },
          { label: 'Mastered by you', value: stats.mastered },
          { label: 'Ready to review', value: stats.due },
        ].map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">
              <strong>{stat.value}</strong>
            </div>
          </article>
        ))}
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Practice</h2>
        <p className="muted" style={{ margin: '12px 0 20px' }}>
          Review due words in random order, recalling either the word or its meaning. Easy words
          need 5 successful reviews, medium 10, and hard 15. Your progress is yours alone.
        </p>
        {course.status === 'archived' ? (
          <p className="muted">
            This course is archived. The owner can reactivate it in course settings.
          </p>
        ) : stats.due ? (
          <form action={startVocabularyReview.bind(null, course.id)}>
            <Submit>Practice</Submit>
          </form>
        ) : (
          <p className="muted">
            {stats.total ? 'You’re caught up for now.' : 'Add some words to begin.'}
            {stats.nextDue &&
              ` Next review: ${formatInTimeZone(new Date(stats.nextDue), user.timezone, 'MMM d, HH:mm')}.`}
          </p>
        )}
        <div className="progress-label" style={{ marginTop: 24 }}>
          <span>
            {stats.mastered} of {stats.total} words mastered
          </span>
        </div>
        <Progress
          value={stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0}
          color={course.color}
        />
      </section>
      {owner && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Add today’s words</h2>
          <p className="muted" style={{ margin: '12px 0 20px' }}>
            Add a meaning and difficulty for each word. Every collaborator can review new words
            immediately.
          </p>
          <VocabularyWordForm courseId={course.id} today={today} />
        </section>
      )}
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Daily word list</h2>
        {!words.length && (
          <p className="muted">{page > 1 ? 'No more words on this page.' : 'No words yet.'}</p>
        )}
        {words.map(({ word, progress }, index) => (
          <div key={word.id}>
            {(index === 0 || words[index - 1].word.addedOn !== word.addedOn) && (
              <h3 className="vocabulary-day">{word.addedOn}</h3>
            )}
            <article className="vocabulary-word">
              <div className="section-header">
                <h3 dir="auto">{word.word}</h3>
                <Badge color={word.difficulty === 'hard' ? 'amber' : 'neutral'}>
                  {word.difficulty}
                </Badge>
              </div>
              <p dir="auto" className="vocabulary-meaning">
                {word.explanation}
              </p>
              {word.example && (
                <p dir="auto" className="muted">
                  {word.example}
                </p>
              )}
              <p className="field-hint">
                Your reviews:{' '}
                {Math.min(progress?.successfulReviews ?? 0, reviewTargets[word.difficulty])} /{' '}
                {reviewTargets[word.difficulty]} ·{' '}
                {(progress?.successfulReviews ?? 0) >= reviewTargets[word.difficulty]
                  ? 'Mastered'
                  : !progress || progress.dueAt <= new Date()
                    ? 'Ready to review'
                    : `Next: ${formatInTimeZone(progress.dueAt, user.timezone, 'MMM d, HH:mm')}`}
              </p>
              {owner && (
                <details>
                  <summary className="text-link">Edit or delete word</summary>
                  <VocabularyWordForm word={word} courseId={course.id} today={today} />
                  <div className="destructive-actions">
                    <DeleteVocabularyWordForm word={word} />
                  </div>
                </details>
              )}
            </article>
          </div>
        ))}
        <Pagination page={page} hasMore={words.length === 50} base={`/courses/${course.id}`} />
      </section>
      {owner && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Collaborators</h2>
          <p className="muted" style={{ margin: '12px 0 20px' }}>
            Add a friend’s account username. They’ll see this course in My courses and can practice
            all its words. Only you can add or edit words and manage collaborators.
          </p>
          <AddVocabularyCollaboratorForm courseId={course.id} />
          {members.map((member) => (
            <details className="vocabulary-member" key={member.id}>
              <summary>
                {member.name || member.username} · @{member.username}
              </summary>
              <div className="destructive-actions">
                <RemoveVocabularyCollaboratorForm courseId={course.id} member={member} />
              </div>
            </details>
          ))}
        </section>
      )}
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Your recent reviews</h2>
        {!history.length && <p className="muted">Your practice record will appear here.</p>}
        {history.map((review, i) => (
          <div className="vocabulary-history" key={i}>
            <span dir="auto">{review.snapshot.word}</span>
            <Badge color={review.remembered ? 'teal' : 'amber'}>
              {review.remembered ? 'Remembered' : 'Review again'}
            </Badge>
            <span className="muted">
              {formatInTimeZone(review.date!, user.timezone, 'MMM d, HH:mm')}
            </span>
          </div>
        ))}
      </section>
      {!owner && (
        <div className="destructive-actions">
          <LeaveVocabularyCourseForm course={course} />
        </div>
      )}
    </>
  );
}
