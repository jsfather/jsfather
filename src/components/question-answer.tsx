'use client';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { isTypedQuestion } from '@/lib/assessment';
import type { SafeQuestion } from '@/lib/safe-questions';

export function isAnswered(q: SafeQuestion, value: string | string[] | undefined) {
  if (Array.isArray(value))
    return q.type === 'matching'
      ? value.length === q.prompts.length && value.every(Boolean)
      : q.type === 'ordering'
        ? value.length === q.options.length
        : value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
}
export function restoreAnswer(q: SafeQuestion, value: unknown): string | string[] | undefined {
  if (isTypedQuestion(q.type))
    return typeof value === 'string' && value.length <= 20000 ? value : undefined;
  if (q.type === 'matching')
    return Array.isArray(value) &&
      value.length === q.prompts.length &&
      value.every((v) => typeof v === 'string' && (v === '' || q.options.some((o) => o.text === v)))
      ? value
      : undefined;
  if (q.type === 'multiple_select' || q.type === 'ordering')
    return Array.isArray(value) &&
      value.length <= q.options.length &&
      new Set(value).size === value.length &&
      value.every((v) => q.options.some((o) => o.id === v))
      ? value
      : undefined;
  return typeof value === 'string' && q.options.some((o) => o.id === value) ? value : undefined;
}
export function QuestionAnswer({
  question: q,
  value,
  onChange,
  disabled,
}: {
  question: SafeQuestion;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  disabled: boolean;
}) {
  if (isTypedQuestion(q.type))
    return (
      <label className="field">
        <span>
          {q.type === 'numeric'
            ? 'Your numeric answer'
            : q.type === 'fill_blank'
              ? 'Fill in the blank'
              : 'Your answer'}
        </span>
        <textarea
          rows={q.type === 'numeric' ? 1 : 3}
          inputMode={q.type === 'numeric' ? 'decimal' : 'text'}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {q.type === 'numeric' && (
          <small className="field-hint">Use a decimal point for fractional numbers.</small>
        )}
      </label>
    );
  if (q.type === 'matching') {
    const matches = Array.isArray(value) ? value : q.prompts.map(() => '');
    return (
      <div>
        {q.prompts.map((prompt, i) => (
          <label className="field" key={i}>
            <span>{prompt}</span>
            <select
              disabled={disabled}
              value={matches[i] ?? ''}
              onChange={(e) =>
                onChange(q.prompts.map((_, k) => (k === i ? e.target.value : (matches[k] ?? ''))))
              }
            >
              <option value="">Choose a match</option>
              {q.options.map((o) => (
                <option
                  key={o.id}
                  value={o.text}
                  disabled={matches.some((match, j) => j !== i && match === o.text)}
                >
                  {o.text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }
  if (q.type === 'ordering') {
    const ids =
      Array.isArray(value) && value.length === q.options.length
        ? value
        : q.options.map((o) => o.id);
    const move = (i: number, step: number) => {
      const next = [...ids];
      [next[i], next[i + step]] = [next[i + step], next[i]];
      onChange(next);
    };
    return (
      <div>
        <p className="field-hint">Arrange the items from first to last, then confirm your order.</p>
        {ids.map((id, i) => (
          <div className="exam-option" key={id}>
            <span>
              {i + 1}. {q.options.find((o) => o.id === id)?.text}
            </span>
            <button
              type="button"
              className="icon-button"
              disabled={disabled || i === 0}
              aria-label={`Move answer item ${i + 1} up`}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={disabled || i === ids.length - 1}
              aria-label={`Move answer item ${i + 1} down`}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={() => onChange(ids)}
        >
          Use this order
        </button>
      </div>
    );
  }
  return (
    <div className="exam-options">
      {q.type === 'multiple_select' && (
        <p className="field-hint">Select all correct answers. No partial credit.</p>
      )}
      {q.options.map((option, i) => (
        <label key={option.id} className="exam-option">
          <input
            type={q.type === 'multiple_select' ? 'checkbox' : 'radio'}
            disabled={disabled}
            name={'question-' + q.id}
            checked={Array.isArray(value) ? value.includes(option.id) : value === option.id}
            onChange={() => {
              if (q.type === 'multiple_select') {
                const selected = Array.isArray(value) ? value : [];
                onChange(
                  selected.includes(option.id)
                    ? selected.filter((id) => id !== option.id)
                    : [...selected, option.id],
                );
              } else onChange(option.id);
            }}
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
  );
}
