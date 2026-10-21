import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function StudyMarkdown({
  children,
  embedded = false,
}: {
  children: string;
  embedded?: boolean;
}) {
  return (
    <div className="study-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        skipHtml
        components={{
          ...(embedded
            ? { h1: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2> }
            : {}),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === 'string' ? (
              <a href={src} target="_blank" rel="noopener noreferrer">
                {alt || 'View linked image'}
              </a>
            ) : null,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
