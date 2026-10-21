import { z } from 'zod';

const segment = '[a-z0-9]+(?:-[a-z0-9]+)*';
export const notePathSchema = z
  .string()
  .max(260)
  .regex(
    new RegExp(`^(?:${segment}/){0,3}${segment}\\.md$`),
    'Use a kebab-case .md filename and up to three kebab-case topic folders.',
  );
export const noteTemplate = `# Concept title

Explain the concept concisely in your own words.

### Key Points
- Add the essential behavior and any important differences.

### Example
\`\`\`text
Replace this with a minimal example and set the correct code language.
\`\`\`

### Reference
Add a verified direct link to official documentation or another primary source.
`;

export function noteTitle(body: string) {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? 'Untitled note';
}

export const noteBodySchema = z
  .string()
  .trim()
  .min(10)
  .max(100000)
  .superRefine((body, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (!/^# [^\n]{1,160}(?:\n|$)/.test(body))
      issue('Start with a single # Title (up to 160 characters).');
    const prose: string[] = [];
    let fence: { marker: string; size: number } | undefined;
    let examples = 0;
    for (const line of body.split('\n')) {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (
          match &&
          match[1][0] === fence.marker &&
          match[1].length >= fence.size &&
          !match[2].trim()
        )
          fence = undefined;
      } else if (match) {
        fence = { marker: match[1][0], size: match[1].length };
        examples++;
        if (!/^[a-zA-Z0-9_+.#-]+(?:\s.*)?$/.test(match[2].trim()))
          issue('Give every fenced code block a language identifier (use text for output).');
      } else prose.push(line);
    }
    if (fence) issue('Close every fenced code block.');
    if (!examples)
      issue('Include a minimal example in a fenced code block with a language identifier.');
    const text = prose.join('\n');
    for (const heading of ['Key Points', 'Example', 'Reference']) {
      if (!new RegExp(`^### ${heading}\\s*$`, 'm').test(text))
        issue(`Include a ### ${heading} section.`);
    }
    const reference = text.split(/^### Reference\s*$/m)[1]?.split(/^#{1,6} /m)[0] ?? '';
    const urls = reference.match(/https?:\/\/[^\s<>)\]]+/g) ?? [];
    if (
      !urls.some((url) => {
        try {
          return Boolean(new URL(url).hostname);
        } catch {
          return false;
        }
      })
    )
      issue('Add a verified, direct https:// or http:// source link in Reference.');
  });
