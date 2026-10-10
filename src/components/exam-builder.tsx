'use client';
import { useState, useActionState } from 'react';
import { Plus, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { ConfirmationDialog } from './confirmation-dialog';
import { saveExam } from '@/actions';
import { Feedback, Submit } from './forms';
import {
  assessmentDefaults,
  questionDefaults,
  isTypedQuestion,
  type QuestionType,
} from '@/lib/assessment';
import type { ClassBankInput } from '@/lib/validation';
import { QuestionTextEditor } from './question-text-editor';
type Question = ClassBankInput['questions'][number];
const blank = (): Question => ({
  question: '',
  difficulty: 'medium',
  type: 'multiple_choice',
  points: 2,
  timeSeconds: 90,
  explanation: '',
  acceptedAnswers: [],
  caseSensitive: false,
  tolerance: 0,
  pairs: [],
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
});
const types: { value: QuestionType; label: string; help: string }[] = [
  { value: 'multiple_choice', label: 'Single choice', help: 'Choose one correct option.' },
  {
    value: 'multiple_select',
    label: 'Multiple answers',
    help: 'Mark all correct options. The learner must select exactly that set to earn points.',
  },
  { value: 'true_false', label: 'True / false', help: 'Choose the correct statement value.' },
  {
    value: 'short_answer',
    label: 'Short answer',
    help: 'The learner types an answer. Add alternatives for equivalent wording.',
  },
  {
    value: 'fill_blank',
    label: 'Fill in the blank',
    help: 'Use ___ for one blank. Add accepted answers below.',
  },
  {
    value: 'numeric',
    label: 'Numeric answer',
    help: 'Enter the expected number and an optional absolute tolerance.',
  },
  {
    value: 'ordering',
    label: 'Put in order',
    help: 'Write items in the correct order. They are shuffled for the learner.',
  },
  {
    value: 'matching',
    label: 'Match pairs',
    help: 'Enter matching pairs. Right-hand choices are shuffled for the learner.',
  },
];
export function ExamBuilder({
  courseId,
  sessionId,
  sessions,
  examId = null,
  initial,
}: {
  courseId: string;
  sessionId: string;
  sessions?: { id: string; title: string }[];
  examId?: string | null;
  initial?: ClassBankInput;
}) {
  const [selectedSession, setSelectedSession] = useState(sessionId);
  const [bank, setBank] = useState<ClassBankInput>(
    initial ?? { passingScore: null, timeLimit: null, published: false, questions: [blank()] },
  );
  const [state, action] = useActionState(
    saveExam.bind(null, courseId, examId, selectedSession),
    {},
  );
  const defaults = assessmentDefaults(bank.questions);
  const update = (index: number, patch: Partial<Question>) =>
    setBank((current) => ({
      ...current,
      questions: current.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  function move(index: number, direction: number) {
    const questions = [...bank.questions],
      target = index + direction;
    if (target < 0 || target >= questions.length) return;
    [questions[index], questions[target]] = [questions[target], questions[index]];
    setBank({ ...bank, questions });
  }
  return (
    <form action={action} className="form-panel">
      <input type="hidden" name="exam" value={JSON.stringify(bank)} />
      <Feedback state={state} />
      {sessions && (
        <label className="field">
          <span>Class</span>
          <select
            required
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            <option value="">Choose a class</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="section-header">
        <h2>Class questions</h2>
        <span className="muted">
          {bank.questions.length} questions · {bank.questions.reduce((sum, q) => sum + q.points, 0)}{' '}
          points
        </span>
      </div>
      {bank.questions.map((q, i) => (
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
                disabled={i === bank.questions.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <ConfirmationDialog
                iconOnly
                trigger={`Remove question ${i + 1}`}
                confirmation={`Question ${i + 1}`}
                description="Remove this question from the draft. Save the exam to apply the change."
                disabled={bank.questions.length === 1}
                onConfirm={() =>
                  setBank({ ...bank, questions: bank.questions.filter((_, index) => index !== i) })
                }
              />
            </div>
          </header>
          <QuestionTextEditor
            type={q.type}
            value={q.question}
            onChange={(question) => update(i, { question })}
          />
          <div className="form-grid">
            <label className="field">
              <span>Question type</span>
              <select
                value={q.type}
                onChange={(e) => {
                  const type = e.target.value as QuestionType;
                  update(i, {
                    type,
                    options:
                      type === 'true_false'
                        ? [
                            { text: 'True', isCorrect: true },
                            { text: 'False', isCorrect: false },
                          ]
                        : isTypedQuestion(type) || type === 'matching'
                          ? []
                          : blank().options,
                    acceptedAnswers: isTypedQuestion(type) ? [''] : [],
                    pairs:
                      type === 'matching'
                        ? [
                            { left: '', right: '' },
                            { left: '', right: '' },
                          ]
                        : [],
                  });
                }}
              >
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Difficulty</span>
              <select
                value={q.difficulty}
                onChange={(e) => {
                  const difficulty = e.target.value as Question['difficulty'],
                    old = questionDefaults[q.difficulty],
                    next = questionDefaults[difficulty];
                  update(i, {
                    difficulty,
                    points: q.points === old.points ? next.points : q.points,
                    timeSeconds:
                      q.timeSeconds === old.timeSeconds ? next.timeSeconds : q.timeSeconds,
                  });
                }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <p className="field-hint">{types.find((type) => type.value === q.type)?.help}</p>
          {isTypedQuestion(q.type) ? (
            <>
              {q.acceptedAnswers.map((answer, j) => (
                <div className="answer-editor" key={j}>
                  <input
                    required
                    aria-label={`Question ${i + 1}, accepted answer ${j + 1}`}
                    value={answer}
                    placeholder={q.type === 'numeric' ? 'Expected number' : 'Accepted answer'}
                    onChange={(e) =>
                      update(i, {
                        acceptedAnswers: q.acceptedAnswers.map((a, k) =>
                          k === j ? e.target.value : a,
                        ),
                      })
                    }
                  />
                  {q.acceptedAnswers.length > 1 && (
                    <ConfirmationDialog
                      iconOnly
                      trigger={`Remove accepted answer ${j + 1}`}
                      confirmation={answer || `Answer ${j + 1}`}
                      description="Remove this accepted answer from the draft. Save the exam to apply the change."
                      onConfirm={() =>
                        update(i, { acceptedAnswers: q.acceptedAnswers.filter((_, k) => k !== j) })
                      }
                    />
                  )}
                </div>
              ))}
              {q.type === 'numeric' ? (
                <label className="field">
                  <span>Absolute tolerance (±)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={q.tolerance}
                    onChange={(e) => update(i, { tolerance: Number(e.target.value) })}
                  />
                </label>
              ) : (
                <>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={q.acceptedAnswers.length >= 20}
                    style={{ marginTop: 16 }}
                    onClick={() => update(i, { acceptedAnswers: [...q.acceptedAnswers, ''] })}
                  >
                    <Plus size={14} />
                    Add accepted alternative
                  </button>
                  <label className="toggle-row">
                    <span>Case-sensitive answer</span>
                    <input
                      type="checkbox"
                      checked={q.caseSensitive}
                      onChange={(e) => update(i, { caseSensitive: e.target.checked })}
                    />
                  </label>
                  <p className="field-hint">Whitespace is normalized before checking answers.</p>
                </>
              )}
            </>
          ) : q.type === 'matching' ? (
            <>
              {q.pairs.map((pair, j) => (
                <div className="form-grid" key={j}>
                  <label className="field">
                    <span>Pair {j + 1} · Prompt</span>
                    <input
                      required
                      value={pair.left}
                      onChange={(e) =>
                        update(i, {
                          pairs: q.pairs.map((p, k) =>
                            k === j ? { ...p, left: e.target.value } : p,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Matching answer</span>
                    <input
                      required
                      value={pair.right}
                      onChange={(e) =>
                        update(i, {
                          pairs: q.pairs.map((p, k) =>
                            k === j ? { ...p, right: e.target.value } : p,
                          ),
                        })
                      }
                    />
                  </label>
                  {q.pairs.length > 2 && (
                    <ConfirmationDialog
                      trigger={`Remove pair ${j + 1}`}
                      confirmation={pair.left || `Pair ${j + 1}`}
                      description="Remove this matching pair from the draft. Save the exam to apply the change."
                      onConfirm={() => update(i, { pairs: q.pairs.filter((_, k) => k !== j) })}
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={q.pairs.length >= 12}
                style={{ marginTop: 16 }}
                onClick={() => update(i, { pairs: [...q.pairs, { left: '', right: '' }] })}
              >
                <Plus size={14} />
                Add pair
              </button>
            </>
          ) : (
            <>
              {q.options.map((option, j) => (
                <div className="answer-editor" key={j}>
                  {q.type !== 'ordering' && (
                    <input
                      type={q.type === 'multiple_select' ? 'checkbox' : 'radio'}
                      name={`correct-${i}`}
                      aria-label={`Option ${j + 1} is correct for question ${i + 1}`}
                      checked={option.isCorrect}
                      onChange={() =>
                        update(i, {
                          options: q.options.map((o, k) => ({
                            ...o,
                            isCorrect:
                              q.type === 'multiple_select'
                                ? k === j
                                  ? !o.isCorrect
                                  : o.isCorrect
                                : k === j,
                          })),
                        })
                      }
                    />
                  )}
                  {q.type === 'ordering' && <span>{j + 1}.</span>}
                  <input
                    aria-label={`Question ${i + 1}, option ${j + 1}`}
                    required
                    maxLength={1000}
                    readOnly={q.type === 'true_false'}
                    placeholder={
                      q.type === 'ordering'
                        ? `Item ${j + 1} in correct order`
                        : `Option ${String.fromCharCode(65 + j)}`
                    }
                    value={option.text}
                    onChange={(e) =>
                      update(i, {
                        options: q.options.map((o, k) =>
                          k === j ? { ...o, text: e.target.value } : o,
                        ),
                      })
                    }
                  />
                  {q.type === 'ordering' && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move item ${j + 1} up`}
                      disabled={j === 0}
                      onClick={() => {
                        const options = [...q.options];
                        [options[j], options[j - 1]] = [options[j - 1], options[j]];
                        update(i, { options });
                      }}
                    >
                      <ArrowUp size={14} />
                    </button>
                  )}
                  {q.type !== 'true_false' && q.options.length > 2 && (
                    <ConfirmationDialog
                      iconOnly
                      trigger={`Remove option ${j + 1}`}
                      confirmation={option.text || `Option ${j + 1}`}
                      description="Remove this option from the draft. Save the exam to apply the change."
                      onConfirm={() => {
                        const options = q.options.filter((_, k) => k !== j);
                        if (q.type === 'multiple_choice' && !options.some((o) => o.isCorrect))
                          options[0].isCorrect = true;
                        update(i, { options });
                      }}
                    />
                  )}
                </div>
              ))}
              {q.type !== 'true_false' && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={q.options.length >= 12}
                  style={{ marginTop: 16 }}
                  onClick={() =>
                    update(i, { options: [...q.options, { text: '', isCorrect: false }] })
                  }
                >
                  <Plus size={14} />
                  Add {q.type === 'ordering' ? 'item' : 'option'}
                </button>
              )}
            </>
          )}
          <details style={{ marginTop: 24 }}>
            <summary>Timing, points & explanation</summary>
            <div className="form-grid">
              <label className="field">
                <span>Points</span>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={q.points}
                  onChange={(e) => update(i, { points: Number(e.target.value) })}
                />
                <small className="field-hint">
                  Suggested: {questionDefaults[q.difficulty].points} ·{' '}
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => update(i, { points: questionDefaults[q.difficulty].points })}
                  >
                    Reset
                  </button>
                </small>
              </label>
              <label className="field">
                <span>Time budget (seconds)</span>
                <input
                  type="number"
                  required
                  min={5}
                  max={3600}
                  value={q.timeSeconds}
                  onChange={(e) => update(i, { timeSeconds: Number(e.target.value) })}
                />
                <small className="field-hint">
                  Suggested: {questionDefaults[q.difficulty].timeSeconds}s ·{' '}
                  <button
                    className="text-link"
                    type="button"
                    onClick={() =>
                      update(i, { timeSeconds: questionDefaults[q.difficulty].timeSeconds })
                    }
                  >
                    Reset
                  </button>
                </small>
              </label>
            </div>
            <label className="field">
              <span>Answer explanation</span>
              <textarea
                rows={2}
                maxLength={3000}
                value={q.explanation}
                onChange={(e) => update(i, { explanation: e.target.value })}
                placeholder="Shown after submission."
              />
            </label>
          </details>
        </section>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() => setBank({ ...bank, questions: [...bank.questions, blank()] })}
      >
        <Plus size={16} />
        Add question
      </button>
      <details style={{ marginTop: 28 }}>
        <summary>
          Practice settings · {bank.timeLimit ?? defaults.timeLimit} min · Pass at{' '}
          {bank.passingScore ?? defaults.passingScore}%
        </summary>
        <p className="field-hint">
          Total time adds question budgets. Suggested passing score weights easy / medium / hard
          mastery targets of 80 / 70 / 60% by points. These are adjustable study defaults.
        </p>
        <div className="form-grid">
          <label className="field">
            <span>Total time (minutes)</span>
            <input
              type="number"
              min={1}
              max={60000}
              required
              value={bank.timeLimit ?? defaults.timeLimit}
              onChange={(e) => setBank({ ...bank, timeLimit: Number(e.target.value) })}
            />
            <button
              type="button"
              className="text-link"
              onClick={() => setBank({ ...bank, timeLimit: null })}
            >
              Use calculated time
            </button>
          </label>
          <label className="field">
            <span>Passing score (%)</span>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={bank.passingScore ?? defaults.passingScore}
              onChange={(e) => setBank({ ...bank, passingScore: Number(e.target.value) })}
            />
            <button
              type="button"
              className="text-link"
              onClick={() => setBank({ ...bank, passingScore: null })}
            >
              Use suggested score
            </button>
          </label>
        </div>
      </details>
      <label className="toggle-row" style={{ marginTop: 24 }}>
        <span>
          <strong>Public practice link</strong>
          <small>Anyone can practice without signing in. Guest results are never saved.</small>
        </span>
        <input
          type="checkbox"
          checked={bank.published}
          onChange={(e) => setBank({ ...bank, published: e.target.checked })}
        />
      </label>
      <div className="form-footer">
        <span className="muted">
          {bank.questions.length} questions · {bank.timeLimit ?? defaults.timeLimit} minutes
        </span>
        <Submit>
          <Save size={16} />
          Save questions
        </Submit>
      </div>
    </form>
  );
}
