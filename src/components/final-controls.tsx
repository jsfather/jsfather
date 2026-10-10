'use client';
import { useActionState } from 'react';
import { generateFinal, setExamPublic, assignExamClass } from '@/actions';
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
        excluded. To earn your certificate, pass at 70% and complete every class in the course.
      </p>
      <form action={action}>
        <Feedback state={state} />
        <Submit>Generate final assessment</Submit>
      </form>
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
