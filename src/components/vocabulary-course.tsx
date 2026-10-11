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
import { dailyVocabulary } from '@/lib/daily-vocabulary';
import { reviewTargets } from '@/lib/vocabulary';
import { startVocabularyReview } from '@/actions/vocabulary';
import { PageTitle, Badge, Progress, Pagination } from './ui';
import { Submit } from './forms';
import {
  LeaveVocabularyCourseForm,
  VocabularyWordForm,
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
  const [stats, words, members, history, suggestionWords, membership] = await Promise.all([
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
          .select({
            id: users.id,
            name: users.name,
            username: users.username,
            role: vocabularyMembers.role,
          })
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
    db
      .select({
        id: vocabularyWords.id,
        word: vocabularyWords.word,
        persianMeaning: vocabularyWords.persianMeaning,
        awlSublist: vocabularyWords.awlSublist,
      })
      .from(vocabularyWords)
      .where(eq(vocabularyWords.courseId, course.id)),
    db
      .select({ role: vocabularyMembers.role })
      .from(vocabularyMembers)
      .where(and(eq(vocabularyMembers.courseId, course.id), eq(vocabularyMembers.userId, user.id))),
  ]);
  const today = formatInTimeZone(new Date(), course.timezone, 'yyyy-MM-dd');
  const suggestions =
    owner || membership[0]?.role === 'collaborator'
      ? dailyVocabulary(suggestionWords, today, course.startDate)
      : [];
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
            <Badge>{membership[0]?.role === 'collaborator' ? 'Collaborator' : 'Learner'}</Badge>
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
      {suggestions.length > 0 && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Today’s suggested words</h2>
          <p className="muted">
            {today} · {course.timezone}. You and invited collaborators receive the same{' '}
            {suggestions.length} words today. Review schedules and progress remain personal.
          </p>
          <div className="vocabulary-word-grid">
            {suggestions.map((word) => (
              <article className="vocabulary-word" key={word.id}>
                <h3>{word.word}</h3>
                <p dir="rtl" lang="fa">
                  {word.persianMeaning}
                </p>
                {word.awlSublist && <Badge>AWL {word.awlSublist}</Badge>}
              </article>
            ))}
          </div>
        </section>
      )}
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
        {Array.from(new Set(words.map(({ word }) => word.addedOn))).map((day) => {
          const dailyWords = words.filter(({ word }) => word.addedOn === day);
          return (
            <section className="vocabulary-day-group" key={day}>
              <header className="vocabulary-day-heading">
                <h3>{formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'EEEE, MMM d')}</h3>
                <span>
                  {dailyWords.length} {dailyWords.length === 1 ? 'word' : 'words'}
                </span>
              </header>
              <div className="vocabulary-word-grid">
                {dailyWords.map(({ word, progress }) => {
                  const target = reviewTargets[word.difficulty];
                  const completed = Math.min(progress?.successfulReviews ?? 0, target);
                  const mastered = completed >= target;
                  const due = !progress || progress.dueAt <= new Date();
                  return (
                    <article className="vocabulary-word" key={word.id}>
                      <header className="vocabulary-word-heading">
                        <h3 dir="auto">{word.word}</h3>
                        <Badge color={word.difficulty === 'hard' ? 'amber' : 'neutral'}>
                          {word.difficulty}
                        </Badge>
                      </header>
                      <p dir="auto" className="vocabulary-meaning">
                        {word.explanation}
                      </p>
                      {word.persianMeaning && word.persianMeaning !== word.explanation && (
                        <p dir="rtl" lang="fa">
                          <strong>معنی فارسی: </strong>
                          {word.persianMeaning}
                        </p>
                      )}
                      {word.awlSublist && <Badge>AWL sublist {word.awlSublist}</Badge>}
                      {word.relatedForms.length > 0 && (
                        <details>
                          <summary>Related word forms ({word.relatedForms.length})</summary>
                          <p>{word.relatedForms.join(', ')}</p>
                        </details>
                      )}
                      {word.sourceUrl && (
                        <a
                          className="text-link"
                          href={word.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Word list source
                        </a>
                      )}
                      {word.example && (
                        <blockquote dir="auto" className="vocabulary-example">
                          {word.example}
                        </blockquote>
                      )}
                      <div className="vocabulary-word-progress">
                        <div>
                          <span>
                            {mastered
                              ? 'Mastered'
                              : due
                                ? 'Ready to review'
                                : `Next: ${formatInTimeZone(progress!.dueAt, user.timezone, 'MMM d, HH:mm')}`}
                          </span>
                          <span>
                            {completed} / {target} reviews
                          </span>
                        </div>
                        <Progress
                          value={Math.round((completed / target) * 100)}
                          color={course.color}
                        />
                      </div>
                      {owner && (
                        <details className="vocabulary-word-editor">
                          <summary className="text-link">Edit or delete word</summary>
                          <VocabularyWordForm word={word} courseId={course.id} today={today} />
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
        {(page > 1 || words.length === 50) && (
          <Pagination page={page} hasMore={words.length === 50} base={`/courses/${course.id}`} />
        )}
      </section>
      {owner && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Collaborators and enrolled learners</h2>
          <p className="muted" style={{ margin: '12px 0 20px' }}>
            Add a friend’s account username. They’ll see this course in My courses and can practice
            all its words and see the same daily suggestions as you. Public learners can join
            themselves with their own practice schedule. Adding an enrolled learner here promotes
            them to collaborator. Only you can add or edit words and manage collaborators.
          </p>
          <AddVocabularyCollaboratorForm courseId={course.id} />
          {members.map((member) => (
            <details className="vocabulary-member" key={member.id}>
              <summary>
                {member.name || member.username} · @{member.username} · {member.role}
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
