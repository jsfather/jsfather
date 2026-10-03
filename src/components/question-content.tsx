import type { ReactNode } from 'react';

type Token = { value: string; kind?: 'comment' | 'string' | 'number' | 'keyword' };

const keywords = new Set(
  'as async await break case catch class const continue default delete do else export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static switch this throw true try type typeof undefined var void while yield'.split(
    ' ',
  ),
);

function highlight(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const add = (value: string, kind?: Token['kind']) => tokens.push({ value, kind });
  while (i < code.length) {
    const rest = code.slice(i);
    if (rest.startsWith('//')) {
      const end = code.indexOf('\n', i);
      add(code.slice(i, end === -1 ? code.length : end), 'comment');
      i = end === -1 ? code.length : end;
    } else if (rest.startsWith('/*')) {
      const end = code.indexOf('*/', i + 2);
      const until = end === -1 ? code.length : end + 2;
      add(code.slice(i, until), 'comment');
      i = until;
    } else if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i];
      let end = i + 1;
      while (end < code.length) {
        if (code[end] === '\\') end += 2;
        else if (code[end++] === quote) break;
      }
      add(code.slice(i, end), 'string');
      i = end;
    } else if (/\d/.test(code[i])) {
      const match = rest.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)!;
      add(match[0], 'number');
      i += match[0].length;
    } else if (/[A-Za-z_$]/.test(code[i])) {
      const match = rest.match(/^[A-Za-z_$][\w$]*/)!;
      add(match[0], keywords.has(match[0]) ? 'keyword' : undefined);
      i += match[0].length;
    } else {
      add(code[i++]);
    }
  }
  return tokens;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const label = language ? `${language} code example` : 'Code example';
  return (
    <pre className="question-code" aria-label={label}>
      <code>
        {highlight(code).map((token, index) =>
          token.kind ? (
            <span className={`token-${token.kind}`} key={index}>
              {token.value}
            </span>
          ) : (
            token.value
          ),
        )}
      </code>
    </pre>
  );
}

/** Renders Markdown-style fenced code without interpreting question text as HTML. */
export function QuestionContent({ children, className }: { children: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const expression = /```([\w+-]*)\r?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(children))) {
    if (match.index > cursor)
      blocks.push(
        <span className="question-prose" key={`text-${cursor}`}>
          {children.slice(cursor, match.index)}
        </span>,
      );
    blocks.push(<CodeBlock code={match[2]} language={match[1]} key={`code-${match.index}`} />);
    cursor = expression.lastIndex;
  }
  if (cursor < children.length || !blocks.length)
    blocks.push(
      <span className="question-prose" key={`text-${cursor}`}>
        {children.slice(cursor)}
      </span>,
    );
  return <div className={className}>{blocks}</div>;
}
