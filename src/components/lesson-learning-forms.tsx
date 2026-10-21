'use client';

import { useActionState } from 'react';
import { saveChapter, addVideoLessons, saveSessionReview } from '@/actions/lesson-learning';
import { Feedback, Submit } from '@/components/forms';

export function ChapterForm({
  courseId,
  chapter,
}: {
  courseId: string;
  chapter?: { id: string; title: string };
}) {
  const [state, action] = useActionState(saveChapter.bind(null, courseId, chapter?.id ?? null), {});
  return (
    <form action={action} className="ui-stack">
      <Feedback state={state} />
      <label className="field">
        <span>{chapter ? 'Chapter title' : 'New chapter title'}</span>
        <input
          name="title"
          required
          minLength={2}
          maxLength={160}
          defaultValue={chapter?.title ?? ''}
          placeholder="01 · Foundations"
        />
      </label>
      <p className="field-hint">Use one chapter per folder, and one session per video.</p>
      <div className="panel-actions">
        <Submit>{chapter ? 'Save chapter' : 'Add chapter'}</Submit>
      </div>
    </form>
  );
}

export function VideoLessonsForm({ courseId, chapterId }: { courseId: string; chapterId: string }) {
  const [state, action] = useActionState(addVideoLessons.bind(null, courseId, chapterId), {});
  return (
    <form action={action} className="ui-stack">
      <Feedback state={state} />
      <label className="field">
        <span>Video titles · one per line</span>
        <textarea
          name="titles"
          rows={5}
          required
          maxLength={20000}
          placeholder={'01 · Introduction\n02 · Your first example'}
        />
      </label>
      <label className="field">
        <span>Default video duration (minutes)</span>
        <input name="duration" type="number" min={1} max={480} defaultValue={30} required />
      </label>
      <p className="field-hint">
        Add up to 100 videos at once. Each becomes a session with its own notes, questions and
        reviews. Sessions start with today’s date; edit each session to adjust its schedule or
        duration.
      </p>
      <div className="panel-actions">
        <Submit>Add video lessons</Submit>
      </div>
    </form>
  );
}

export function SessionReviewForm({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState(saveSessionReview.bind(null, sessionId), {});
  return (
    <form action={action} className="ui-stack" aria-label="Session review">
      <Feedback state={state} />
      <label className="field">
        <span>Key points I remember</span>
        <textarea
          name="keyPoints"
          rows={5}
          required
          minLength={2}
          maxLength={20000}
          placeholder="Explain the ideas in your own words, then compare with your notes."
        />
      </label>
      <label className="field">
        <span>Open questions</span>
        <textarea
          name="questions"
          rows={3}
          maxLength={10000}
          placeholder="What is still unclear? What would be a useful practice question?"
        />
      </label>
      <label className="field">
        <span>Understanding after this review</span>
        <select name="confidence" defaultValue="developing">
          <option value="revisit">Need to revisit</option>
          <option value="developing">Still developing</option>
          <option value="confident">Can explain independently</option>
        </select>
      </label>
      <p className="field-hint">
        Recall first, check your notes, then record gaps. Revisit difficult ideas in a later study
        session. Reviews stay private and do not mark the lesson completed.
      </p>
      <div className="panel-actions">
        <Submit>Save review</Submit>
      </div>
    </form>
  );
}
