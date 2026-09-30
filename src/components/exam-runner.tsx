'use client';
import { useState, useEffect, useRef, useActionState } from 'react';
import { Clock, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { submitAttempt } from '@/actions';
import { Feedback, Submit } from './forms';
type SafeQuestion = {
  id: string;
  question: string;
  points: number;
  options: { id: string; text: string }[];
};
export function ExamRunner({
  attemptId,
  questions,
  expiresAt,
  initialSeconds,
}: {
  attemptId: string;
  questions: SafeQuestion[];
  expiresAt: number;
  initialSeconds: number;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(initialSeconds);
  const [ready, setReady] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [state, action, pending] = useActionState(submitAttempt.bind(null, attemptId), {});
  const form = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);
  // Browser storage is an external system; restore its snapshot after hydration.
  /* eslint-disable react-hooks/set-state-in-effect -- Restore a browser storage snapshot after hydration. */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('exam-' + attemptId) ?? '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const clean: Record<string, string> = {};
        for (const q of questions) {
          if (q.options.some((o) => o.id === saved[q.id])) clean[q.id] = saved[q.id];
        }
        setAnswers(clean);
      }
    } catch {}
    setReady(true);
  }, [attemptId, questions]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem('exam-' + attemptId, JSON.stringify(answers));
      } catch {}
  }, [answers, attemptId, ready]);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => {
    if (ready && seconds === 0 && !autoSubmitted.current && !pending) {
      autoSubmitted.current = true;
      form.current?.requestSubmit();
    }
  }, [seconds, ready, pending]);
  const q = questions[current];
  if (!q) return <p>No questions are available.</p>;
  return (
    <>
      <div className="section-header">
        <span className="muted">
          Question {current + 1} of {questions.length} · {q.points}{' '}
          {q.points === 1 ? 'point' : 'points'}
        </span>
        <div className="exam-timer" style={{ color: seconds < 60 ? '#e8bd76' : undefined }}>
          <Clock size={17} />
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </div>
      </div>
      <div className="question-nav">
        {questions.map((item, i) => (
          <button
            type="button"
            aria-label={`Go to question ${i + 1}`}
            key={item.id}
            className={`${answers[item.id] ? 'answered' : ''} ${i === current ? 'current' : ''}`}
            onClick={() => setCurrent(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <section className="panel">
        <h2 className="exam-question-title">{q.question}</h2>
        <div className="exam-options">
          {q.options.map((option, i) => (
            <label key={option.id} className="exam-option">
              <input
                type="radio"
                disabled={seconds === 0 || pending}
                name={'question-' + q.id}
                checked={answers[q.id] === option.id}
                onChange={() => setAnswers({ ...answers, [q.id]: option.id })}
              />
              <span>
                <span style={{ color: 'var(--muted)', marginRight: 14 }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {option.text}
              </span>
            </label>
          ))}
        </div>
        <div className="form-footer">
          <div className="actions-row" style={{ margin: 0 }}>
            <button
              type="button"
              className="button secondary"
              disabled={current === 0}
              onClick={() => setCurrent(current - 1)}
            >
              <ChevronLeft size={15} />
              Previous
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={current === questions.length - 1}
              onClick={() => setCurrent(current + 1)}
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
          <span className="muted">
            {Object.keys(answers).length} of {questions.length} answered
          </span>
        </div>
      </section>
      <form ref={form} action={action} style={{ marginTop: 24 }}>
        <input type="hidden" name="answers" value={JSON.stringify(answers)} />
        <Feedback state={state} />
        {confirm || seconds === 0 ? (
          <div className="panel">
            <h3>{seconds === 0 ? 'Time is up.' : 'Ready to submit?'}</h3>
            <p className="muted" style={{ margin: '10px 0 20px' }}>
              {questions.length - Object.keys(answers).length} unanswered questions. You can’t
              change answers after submitting.
            </p>
            <div className="actions-row" style={{ margin: 0 }}>
              <Submit>
                <Send size={16} />
                Submit answers
              </Submit>
              {seconds > 0 && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setConfirm(false)}
                >
                  Keep reviewing
                </button>
              )}
            </div>
          </div>
        ) : (
          <button type="button" className="button primary" onClick={() => setConfirm(true)}>
            <Send size={16} />
            Submit exam
          </button>
        )}
      </form>
      <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
        The timer keeps running if you leave this page. Answers are saved on this device. Your exam
        submits automatically when time runs out.
      </p>
    </>
  );
}
