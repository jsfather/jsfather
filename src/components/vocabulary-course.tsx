import Link from 'next/link';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
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
        asc(vocabularyWords.awlSublist),
        asc(vocabularyWords.word),
        asc(vocabularyWords.id),
      )
      .limit(24)
      .offset((page - 1) * 24),
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
    <div className="vocabulary-course-layout">
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
      <section className="panel vocabulary-section">
        <div className="vocabulary-practice-header">
          <div>
            <p className="eyebrow">YOUR NEXT STEP</p>
            <h2>Practice</h2>
            <p className="muted">Recall a word or its meaning, then check your answer.</p>
          </div>
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
        </div>
        <div className="vocabulary-mastery">
          <div className="progress-label">
            <span>
              {stats.mastered} of {stats.total} words mastered
            </span>
          </div>
          <Progress
            value={stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0}
            color={course.color}
          />
        </div>
        <details className="vocabulary-help">
          <summary>How practice works</summary>
          <p className="muted">
            Due words are shuffled. Easy words need 5 successful recalls, medium 10, and hard 15.
            Your review schedule and progress are personal.
          </p>
        </details>
      </section>
      {suggestions.length > 0 && (
        <section className="panel vocabulary-section">
          <header className="vocabulary-section-heading">
            <div>
              <h2>Today’s suggested words</h2>
              <p className="muted">A shared daily selection for you and your collaborators.</p>
            </div>
            <span className="vocabulary-section-meta">
              {formatInTimeZone(new Date(), course.timezone, 'MMM d')} · {course.timezone}
            </span>
          </header>
          <div className="vocabulary-suggestion-grid">
            {suggestions.map((word) => (
              <article className="vocabulary-suggestion" key={word.id}>
                <header>
                  <h3>{word.word}</h3>
                  {word.awlSublist && (
                    <span className="vocabulary-sublist">AWL {word.awlSublist}</span>
                  )}
                </header>
                <p dir="rtl" lang="fa">
                  {word.persianMeaning}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="panel vocabulary-section">
        <header className="vocabulary-section-heading">
          <div>
            <h2>Word library</h2>
            <p className="muted">
              {stats.total} words · grouped by date, then AWL sublist and spelling
            </p>
          </div>
          <span className="vocabulary-section-meta">
            Page {page} of {Math.max(1, Math.ceil(stats.total / 24))}
          </span>
        </header>
        {owner && (
          <details className="vocabulary-add-word">
            <summary>Add a word</summary>
            <div className="vocabulary-disclosure-body">
              <h2>Add today’s words</h2>
              <p className="muted">
                Add a meaning and difficulty for each word. Every collaborator can review new words
                immediately.
              </p>
              <VocabularyWordForm courseId={course.id} today={today} />
            </div>
          </details>
        )}

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
                      {(word.relatedForms.length > 0 || word.sourceUrl || word.awlSublist) && (
                        <details className="vocabulary-word-details">
                          <summary>
                            Word details{word.awlSublist ? ` · AWL ${word.awlSublist}` : ''}
                          </summary>
                          <div>
                            {word.relatedForms.length > 0 && (
                              <p>
                                <strong>Related forms</strong>
                                <br />
                                {word.relatedForms.join(', ')}
                              </p>
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
                          </div>
                        </details>
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
        {(page > 1 || words.length === 24) && (
          <Pagination page={page} hasMore={words.length === 24} base={`/courses/${course.id}`} />
        )}
      </section>
      {owner && (
        <details className="panel vocabulary-section vocabulary-disclosure">
          <summary>
            Collaborators and enrolled learners <span>{members.length} members</span>
          </summary>
          <div className="vocabulary-disclosure-body">
            <h2>Manage members</h2>
            <p className="muted">
              Add a friend’s account username. They’ll see this course in My courses and can
              practice all its words and see the same daily suggestions as you. Public learners can
              join themselves with their own practice schedule. Adding an enrolled learner here
              promotes them to collaborator. Only you can add or edit words and manage
              collaborators.
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
          </div>
        </details>
      )}
      <details className="panel vocabulary-section vocabulary-disclosure">
        <summary>
          Your recent reviews{' '}
          <span>{history.length ? `${history.length} recent` : 'No reviews yet'}</span>
        </summary>
        <div className="vocabulary-disclosure-body">
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
        </div>
      </details>
      {!owner && (
        <div className="destructive-actions">
          <LeaveVocabularyCourseForm course={course} />
        </div>
      )}
    </div>
  );
}
