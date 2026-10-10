'use client';
import { useActionState, useState } from 'react';
import { generateFinal, setExamPublic, assignExamClass, updateAssessmentSettings } from '@/actions';
import { Feedback, Submit } from './forms';

export function FinalControls({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(generateFinal.bind(null, courseId), {});
  return (
    <section className="panel">
      <h2>Final assessment</h2>
      <p className="muted" style={{ margin: '12px 0 20px' }}>
        Generate an assessment anytime from the classes that have questions, even before studying
        them. It selects up to 30 questions (at least one per participating class), balancing
        classes and easy / medium / hard levels where available. Classes without questions are
        excluded. Time and passing score are suggested from the selected questions and can be
        changed for future attempts. To earn your certificate, pass and complete every class in the
        course.
      </p>
      <form action={action}>
        <Feedback state={state} />
        <Submit>Generate final assessment</Submit>
      </form>
    </section>
  );
}
export function AssessmentSettings({
  id,
  timeLimit,
  passingScore,
  suggested,
  locked,
}: {
  id: string;
  timeLimit: number;
  passingScore: number;
  suggested: { timeLimit: number; passingScore: number };
  locked: boolean;
}) {
  const [settings, setSettings] = useState({ timeLimit, passingScore });
  const [state, action] = useActionState(updateAssessmentSettings.bind(null, id), {});
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>Assessment settings</h2>
      <p className="field-hint">
        Suggested time: {suggested.timeLimit} min · Suggested passing score:{' '}
        {suggested.passingScore}%. The score uses point-weighted easy / medium / hard mastery
        targets of 80 / 70 / 60%. These are editable personal-study defaults.
      </p>
      {locked ? (
        <p className="muted">Finish the older active attempt before changing settings.</p>
      ) : (
        <form action={action}>
          <p className="field-hint">
            Changes apply to new attempts. Active attempts keep their original timer and passing
            score.
          </p>
          <Feedback state={state} />
          <div className="form-grid">
            <label className="field">
              <span>Total time (minutes)</span>
              <input
                name="timeLimit"
                type="number"
                required
                min={1}
                max={60000}
                value={settings.timeLimit}
                onChange={(e) => setSettings({ ...settings, timeLimit: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Passing score (%)</span>
              <input
                name="passingScore"
                type="number"
                required
                min={1}
                max={100}
                value={settings.passingScore}
                onChange={(e) => setSettings({ ...settings, passingScore: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="actions-row">
            <button
              type="button"
              className="button secondary"
              onClick={() => setSettings(suggested)}
            >
              Use suggested settings
            </button>
            <Submit>Save settings</Submit>
          </div>
        </form>
      )}
    </section>
  );
}

export function PublicExamControl({ id, published }: { id: string; published: boolean }) {
  const [state, action] = useActionState(setExamPublic.bind(null, id, !published), {});
  return (
    <form action={action}>
      <Feedback state={state} />
      <Submit>{published ? 'Disable public link' : 'Enable public link'}</Submit>
    </form>
  );
}
export function AssignExamClass({
  id,
  sessions,
}: {
  id: string;
  sessions: { id: string; title: string }[];
}) {
  const [state, action] = useActionState(assignExamClass.bind(null, id), {});
  return (
    <form action={action} className="panel">
      <h2>Assign existing questions to a class</h2>
      <p className="muted">
        Existing questions and attempts are preserved. Choose the class these questions cover so
        they can be included in your final.
      </p>
      <Feedback state={state} />
      <label className="field">
        <span>Class</span>
        <select name="sessionId" required defaultValue="">
          <option value="">Choose a class</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <Submit>Assign class</Submit>
    </form>
  );
}
