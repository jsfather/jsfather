'use client';
import { useActionState } from 'react';
import {
  leaveVocabularyCourse,
  createVocabularyCourse,
  editVocabularyCourse,
  saveVocabularyWord,
  deleteVocabularyWord,
  addVocabularyCollaborator,
  removeVocabularyCollaborator,
  revealVocabularyReview,
  submitVocabularyReview,
} from '@/actions/vocabulary';
import { ConfirmationDialog } from './confirmation-dialog';
import { Feedback, Submit } from './forms';
import type { Course, VocabularyWord } from '@/db/schema';
import { reviewTargets } from '@/lib/vocabulary';

export function VocabularyCourseForm({ course, timezone }: { course?: Course; timezone: string }) {
  const [state, action] = useActionState(
    course ? editVocabularyCourse.bind(null, course.id) : createVocabularyCourse,
    {},
  );
  return (
    <form action={action} className="form-panel">
      <h2>{course ? 'Vocabulary course settings' : 'Language vocabulary course'}</h2>
      <p className="muted">
        Add words each day and practice at your own pace. Every learner has their own review
        schedule.
      </p>
      <Feedback state={state} />
      <label className="field">
        <span>Course name</span>
        <input
          name="title"
          required
          minLength={2}
          maxLength={160}
          defaultValue={course?.title}
          placeholder="e.g. Everyday English"
        />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={course?.description ?? ''}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Language</span>
          <input
            name="category"
            required
            maxLength={80}
            defaultValue={course?.category}
            placeholder="e.g. English"
          />
        </label>
        <label className="field">
          <span>Language level</span>
          <select name="difficulty" defaultValue={course?.difficulty ?? 'beginner'}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="field">
          <span>Course color</span>
          <select name="color" defaultValue={course?.color ?? 'violet'}>
            {['teal', 'blue', 'violet', 'amber', 'rose', 'sky', 'indigo', 'orange', 'fuchsia'].map(
              (color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          <span>Timezone</span>
          <input name="timezone" required defaultValue={course?.timezone ?? timezone} />
        </label>
      </div>
      {course && (
        <label className="field">
          <span>Course status</span>
          <select name="status" defaultValue={course.status}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      )}
      <p className="field-hint">
        Easy: 5 successful reviews · Medium: 10 · Hard: 15. Words are shuffled when due.
        Collaborators can practice; only you can manage the word list.
      </p>
      <Submit>{course ? 'Save course' : 'Create vocabulary course'}</Submit>
    </form>
  );
}
export function VocabularyWordForm({
  courseId,
  word,
  today,
}: {
  courseId: string;
  word?: VocabularyWord;
  today: string;
}) {
  const [state, action] = useActionState(
    saveVocabularyWord.bind(null, courseId, word?.id ?? null),
    {},
  );
  return (
    <form action={action} className="vocabulary-word-form">
      <Feedback state={state} />
      <div className="form-grid">
        <label className="field">
          <span>Word or phrase</span>
          <input name="word" dir="auto" required maxLength={200} defaultValue={word?.word} />
        </label>
        <label className="field">
          <span>Difficulty</span>
          <select name="difficulty" defaultValue={word?.difficulty ?? 'medium'}>
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <option value={d} key={d}>
                {d} · {reviewTargets[d]} reviews
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Added on</span>
          <input name="addedOn" type="date" required defaultValue={word?.addedOn ?? today} />
        </label>
      </div>
      <label className="field">
        <span>Meaning / explanation</span>
        <textarea
          name="explanation"
          dir="auto"
          required
          maxLength={5000}
          rows={3}
          defaultValue={word?.explanation}
        />
      </label>
      <label className="field">
        <span>Example sentence (optional)</span>
        <textarea name="example" maxLength={2000} rows={2} defaultValue={word?.example ?? ''} />
      </label>
      {word && (
        <p className="field-hint">
          Changing the word or its meaning restarts every learner’s mastery progress. Review history
          is kept.
        </p>
      )}
      <Submit>{word ? 'Save word' : 'Add word'}</Submit>
    </form>
  );
}
export function DeleteVocabularyWordForm({ word }: { word: VocabularyWord }) {
  return (
    <ConfirmationDialog
      trigger="Delete word"
      confirmation={word.word}
      inputLabel="Word to confirm deletion"
      description="This action cannot be undone. This permanently deletes this word and its review records for every learner."
      action={deleteVocabularyWord.bind(null, word.courseId, word.id)}
    />
  );
}
export function AddVocabularyCollaboratorForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(addVocabularyCollaborator.bind(null, courseId), {});
  return (
    <form action={action}>
      <Feedback state={state} />
      <label className="field">
        <span>Collaborator username</span>
        <input
          name="username"
          required
          minLength={3}
          maxLength={60}
          placeholder="Their username from Settings"
          autoComplete="off"
        />
      </label>
      <Submit>Add collaborator</Submit>
    </form>
  );
}
export function RemoveVocabularyCollaboratorForm({
  courseId,
  member,
}: {
  courseId: string;
  member: { id: string; username: string };
}) {
  return (
    <ConfirmationDialog
      trigger="Remove collaborator"
      confirmation={member.username}
      inputLabel="Username to confirm removal"
      description={`Remove access for @${member.username}. Their saved review history is preserved if you add them again.`}
      action={removeVocabularyCollaborator.bind(null, courseId, member.id)}
    />
  );
}
export function VocabularyReviewCard({
  courseId,
  reviewId,
  word,
  direction,
  revealed,
  successfulReviews,
}: {
  courseId: string;
  reviewId: string;
  word: VocabularyWord;
  direction: 'word' | 'meaning';
  revealed: boolean;
  successfulReviews: number;
}) {
  const [revealState, revealAction] = useActionState(
    revealVocabularyReview.bind(null, courseId, reviewId),
    {},
  );
  const [state, action] = useActionState(submitVocabularyReview.bind(null, courseId, reviewId), {});
  const showAnswer = revealed || Boolean(revealState.success);
  return (
    <section className="panel vocabulary-review-card">
      <p className="eyebrow">{direction === 'word' ? 'RECALL THE MEANING' : 'RECALL THE WORD'}</p>
      <h2 dir="auto" className="vocabulary-prompt">
        {direction === 'word' ? word.word : word.explanation}
      </h2>
      <p className="muted">
        {word.difficulty} · {successfulReviews} / {reviewTargets[word.difficulty]} successful
        reviews
      </p>
      <Feedback state={state} />
      {showAnswer ? (
        <>
          <div className="vocabulary-answer">
            <h3 dir="auto">{direction === 'word' ? word.explanation : word.word}</h3>
            {word.example && <p dir="auto">{word.example}</p>}
          </div>
          <p className="muted">Did you recall the answer before revealing it?</p>
          <form action={action} className="actions-row">
            <Submit secondary name="rating" value="again">
              Review again
            </Submit>
            <Submit name="rating" value="remembered">
              Remembered
            </Submit>
          </form>
          <p className="field-hint">
            Remembered adds one successful review. Review again keeps your progress and brings this
            word back in ten minutes.
          </p>
        </>
      ) : (
        <form action={revealAction} className="vocabulary-reveal-form">
          <Feedback state={revealState} />
          <Submit>Reveal answer</Submit>
        </form>
      )}
    </section>
  );
}

export function LeaveVocabularyCourseForm({ course }: { course: Course }) {
  return (
    <ConfirmationDialog
      trigger="Leave course"
      confirmation={course.title}
      inputLabel="Course title to confirm leaving"
      description="You will lose access to this course. Your saved review history is preserved if the owner adds you again."
      action={leaveVocabularyCourse.bind(null, course.id)}
    />
  );
}
