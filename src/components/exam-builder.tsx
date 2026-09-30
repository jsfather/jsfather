'use client';
import { useState, useActionState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2, Save } from 'lucide-react';
import { saveExam } from '@/actions';
import { Feedback, Submit } from './forms';
import type { ExamInput } from '@/lib/validation';
const blank = (): ExamInput['questions'][number] => ({
  question: '',
  type: 'multiple_choice',
  points: 1,
  explanation: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});
export function ExamBuilder({
  courseId,
  examId = null,
  initial,
}: {
  courseId: string;
  examId?: string | null;
  initial?: ExamInput;
}) {
  const [exam, setExam] = useState<ExamInput>(
    initial ?? {
      title: '',
      description: '',
      passingScore: 70,
      timeLimit: 30,
      published: false,
      questions: [blank()],
    },
  );
  const [state, action] = useActionState(saveExam.bind(null, courseId, examId), {});
  const update = (index: number, q: Partial<ExamInput['questions'][number]>) =>
    setExam({
      ...exam,
      questions: exam.questions.map((item, i) => (i === index ? { ...item, ...q } : item)),
    });
  function move(index: number, dir: number) {
    const questions = [...exam.questions];
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    [questions[index], questions[target]] = [questions[target], questions[index]];
    setExam({ ...exam, questions });
  }
  return (
    <form action={action} className="form-panel">
      <input type="hidden" name="exam" value={JSON.stringify(exam)} />
      <Feedback state={state} />
      <label className="field">
        <span>Exam title</span>
        <input
          required
          minLength={2}
          maxLength={160}
          placeholder="e.g. JavaScript final assessment"
          value={exam.title}
          onChange={(e) => setExam({ ...exam, title: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          rows={3}
          maxLength={5000}
          value={exam.description}
          onChange={(e) => setExam({ ...exam, description: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Passing score (%)</span>
          <input
            type="number"
            min={1}
            max={100}
            required
            value={exam.passingScore}
            onChange={(e) => setExam({ ...exam, passingScore: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Time limit (minutes)</span>
          <input
            type="number"
            min={1}
            max={240}
            required
            value={exam.timeLimit}
            onChange={(e) => setExam({ ...exam, timeLimit: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="section-header">
        <h2>Questions</h2>
        <span className="muted">{exam.questions.length} questions</span>
      </div>
      {exam.questions.map((q, i) => (
        <section key={i} className="question-editor">
          <header>
            <h3>Question {i + 1}</h3>
            <div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move question ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move question ${i + 1} down`}
                disabled={i === exam.questions.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove question ${i + 1}`}
                disabled={exam.questions.length === 1}
                onClick={() =>
                  setExam({ ...exam, questions: exam.questions.filter((_, idx) => idx !== i) })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </header>
          <label className="field">
            <span>Question text</span>
            <textarea
              rows={2}
              required
              minLength={2}
              maxLength={160}
              value={q.question}
              onChange={(e) => update(i, { question: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Question type</span>
              <select
                value={q.type}
                onChange={(e) => {
                  const type = e.target.value as typeof q.type;
                  update(i, {
                    type,
                    options:
                      type === 'true_false'
                        ? [
                            { text: 'True', isCorrect: true },
                            { text: 'False', isCorrect: false },
                          ]
                        : blank().options,
                  });
                }}
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="true_false">True / false</option>
              </select>
            </label>
            <label className="field">
              <span>Points</span>
              <input
                required
                type="number"
                min={1}
                max={100}
                value={q.points}
                onChange={(e) => update(i, { points: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Select the correct answer. It will be hidden during the exam.
          </p>
          {q.options.map((option, j) => (
            <div key={j} className="answer-editor">
              <input
                type="radio"
                name={`correct-${i}`}
                aria-label={`Option ${j + 1} is correct for question ${i + 1}`}
                checked={option.isCorrect}
                onChange={() =>
                  update(i, { options: q.options.map((o, k) => ({ ...o, isCorrect: k === j })) })
                }
              />
              <input
                aria-label={`Question ${i + 1}, option ${j + 1}`}
                required
                maxLength={1000}
                readOnly={q.type === 'true_false'}
                placeholder={`Option ${String.fromCharCode(65 + j)}`}
                value={option.text}
                onChange={(e) =>
                  update(i, {
                    options: q.options.map((o, k) =>
                      k === j ? { ...o, text: e.target.value } : o,
                    ),
                  })
                }
              />
              {q.type === 'multiple_choice' && q.options.length > 2 && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove option ${j + 1}`}
                  onClick={() => {
                    const options = q.options.filter((_, k) => k !== j);
                    if (!options.some((o) => o.isCorrect)) options[0].isCorrect = true;
                    update(i, { options });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {q.type === 'multiple_choice' && q.options.length < 6 && (
            <button
              type="button"
              className="text-link"
              style={{ border: 0, background: 'none', marginTop: 12 }}
              onClick={() => update(i, { options: [...q.options, { text: '', isCorrect: false }] })}
            >
              <Plus size={13} />
              Add option
            </button>
          )}
          <label className="field">
            <span>Answer explanation</span>
            <textarea
              maxLength={3000}
              rows={2}
              placeholder="Explain why this answer is correct. Shown after submission."
              value={q.explanation}
              onChange={(e) => update(i, { explanation: e.target.value })}
            />
          </label>
        </section>
      ))}
      <button
        className="button secondary"
        type="button"
        disabled={exam.questions.length >= 100}
        onClick={() => setExam({ ...exam, questions: [...exam.questions, blank()] })}
      >
        <Plus size={16} />
        Add question
      </button>
      <label className="toggle-row" style={{ marginTop: 25 }}>
        <div>
          <span>
            <strong>Publish this exam</strong>
            <small>
              Published exams can be taken. Questions lock when the first attempt begins.
            </small>
          </span>
        </div>
        <input
          type="checkbox"
          checked={exam.published}
          onChange={(e) => setExam({ ...exam, published: e.target.checked })}
        />
      </label>
      <div className="form-footer">
        <span className="muted">
          {exam.questions.reduce((sum, q) => sum + q.points, 0)} total points
        </span>
        <Submit>
          <Save size={16} />
          Save exam
        </Submit>
      </div>
    </form>
  );
}
