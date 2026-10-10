'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Code2, Eye, Lightbulb } from 'lucide-react';
import type { QuestionType } from '@/lib/assessment';
import { QuestionContent } from './question-content';

const guides: Record<
  QuestionType,
  { name: string; tip: string; example: string; steps: string[] }
> = {
  multiple_choice: {
    name: 'Single choice',
    tip: 'Ask one focused question with one clearly correct answer.',
    example: 'Which JavaScript keyword declares a block-scoped variable?',
    steps: [
      'Write the question without including the answer.',
      'Add distinct options below, including plausible incorrect answers.',
      'Select the radio button beside the one correct option.',
    ],
  },
  multiple_select: {
    name: 'Multiple answers',
    tip: 'Tell the learner to select all answers that apply.',
    example: 'Which of these JavaScript values are primitive types? Select all that apply.',
    steps: [
      'State that more than one answer can be correct.',
      'Add options and check every correct answer below.',
      'The learner must select the exact correct set; there is no partial credit.',
    ],
  },
  true_false: {
    name: 'True / false',
    tip: 'Write one statement that is unambiguously true or false.',
    example: 'A JavaScript closure can retain access to its outer lexical scope.',
    steps: [
      'Use a single statement; avoid combining two separate claims.',
      'Choose True or False below as the correct answer.',
      'Use the explanation field to clarify why the statement is true or false.',
    ],
  },
  short_answer: {
    name: 'Short answer',
    tip: 'Ask for a short, specific response that can be checked against accepted answers.',
    example: 'What is the term for a function that retains access to its outer lexical scope?',
    steps: [
      'Ask for a term or short phrase, rather than an open-ended essay.',
      'Enter an accepted answer below, such as “closure”. Add equivalent alternatives if needed.',
      'Whitespace is normalized. Enable case sensitivity only when letter case matters.',
    ],
  },
  fill_blank: {
    name: 'Fill in the blank',
    tip: 'Place ___ exactly where the learner should supply the missing word or phrase.',
    example: 'A function that retains access to its outer lexical scope is called a ___.',
    steps: [
      'Use one blank per question so the expected response is clear.',
      'Enter the missing word below, such as “closure”. Add accepted alternatives if needed.',
      'The learner types the missing answer; include any surrounding context in the question.',
    ],
  },
  numeric: {
    name: 'Numeric answer',
    tip: 'Specify the calculation, units, and any rounding the learner should use.',
    example: 'What is 15% of 80? Enter a number without the percent sign.',
    steps: [
      'Write the problem and clarify the expected units or format.',
      'Set the expected number below, such as 12.',
      'Use absolute tolerance for rounded answers: 3.14 with ±0.01 accepts 3.13 through 3.15.',
    ],
  },
  ordering: {
    name: 'Put in order',
    tip: 'Explain the sequence the learner needs to reconstruct.',
    example: 'Put these development steps in order, from first to last.',
    steps: [
      'State the ordering rule, such as earliest to latest or first to last.',
      'Add the items below in their correct order. Use the arrows to adjust them.',
      'Items are shuffled for the learner. The entire sequence must be correct.',
    ],
  },
  matching: {
    name: 'Match pairs',
    tip: 'Tell the learner what relationship to match, such as a term to its definition.',
    example: 'Match each JavaScript keyword to its description.',
    steps: [
      'Explain which two kinds of items should be matched.',
      'Add unique prompt–answer pairs below, such as “const” → “Cannot be reassigned”.',
      'Answer choices are shuffled. All pairs must match to earn points.',
    ],
  },
};

export function QuestionTextEditor({
  type,
  value,
  onChange,
}: {
  type: QuestionType;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const guide = guides[type];
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = Math.min(400, Math.max(132, element.scrollHeight)) + 'px';
  }, [value]);
  function insertCode() {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart,
      end = element.selectionEnd;
    const code = value.slice(start, end) || '// Write your code here';
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
    const snippet = prefix + '```js\n' + code + '\n```\n';
    onChange(value.slice(0, start) + snippet + value.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      const codeStart = start + prefix.length + 6;
      element.setSelectionRange(codeStart, codeStart + code.length);
    });
  }
  return (
    <div className="question-compose">
      <label className="field" htmlFor={id}>
        <span>Question text</span>
      </label>
      <textarea
        ref={textarea}
        id={id}
        className="question-text-input"
        rows={4}
        required
        minLength={2}
        aria-describedby={id + '-tip'}
        placeholder={guide.example}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="question-compose-toolbar">
        <span className="field-hint">No character limit · Text and code supported</span>
        <div>
          <button type="button" className="button secondary" onClick={insertCode}>
            <Code2 size={14} />
            Insert code
          </button>
          <button
            type="button"
            className="button secondary"
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            <Eye size={14} />
            {preview ? 'Hide preview' : 'Preview'}
          </button>
        </div>
      </div>
      {preview && (
        <div className="question-compose-preview" aria-label="Question preview">
          {value.trim() ? (
            <QuestionContent>{value}</QuestionContent>
          ) : (
            <p className="muted">Your question preview will appear here as you write.</p>
          )}
        </div>
      )}
      <div className="question-writing-help" id={id + '-tip'}>
        <div className="question-writing-tip">
          <Lightbulb size={16} />
          <p>
            <strong>{guide.name}</strong>
            <span>{guide.tip}</span>
          </p>
        </div>
        <details>
          <summary>How to write this question · Example</summary>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="question-writing-example">
            <span>Example question</span>
            <p>{guide.example}</p>
          </div>
          <p className="field-hint">
            For code, click Insert code or wrap it in triple backticks with a language such as js,
            ts, or json. Use Preview to check the formatting. Correct answers belong in the answer
            fields below.
          </p>
        </details>
      </div>
    </div>
  );
}
