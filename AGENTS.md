# Repository UI rules

## Spacing is a required part of every UI change

- Use the shared spacing scale in `src/app/globals.css`: 8px for labels and controls, 16px between related blocks and between helper text and actions, and 24px between sections.
- Use `.ui-stack` for vertical form/panel content and `.panel-actions` for panel action rows. A vertical stack owns its gaps; do not add child margins that double them.
- Never let helper text touch the next button, form, input group, or action row. Keep at least 16px of visible separation, including when text wraps on a phone.
- Keep headings separate from form labels and descriptions. Do not rely on browser paragraph margins or Tailwind resets to provide spacing.
- Keep the last action row free of trailing margins so panel padding determines the bottom space. Align buttons and secondary links vertically, and let action rows wrap with a deliberate gap.
- Avoid one-off inline spacing fixes when a shared layout rule can address the cause. Audit other uses of the affected shared component when fixing a spacing bug.
- Before declaring a UI change done, inspect actual rendered screenshots at 1280px desktop and 320px/390px mobile widths. Wait for the real content to render; a loading skeleton is not verification.
- Inspect empty, populated, revealed, and feedback states relevant to the change. Check helper-to-action gaps, heading-to-form gaps, panel bottom padding, wrapping, and fixed controls covering content. Passing typecheck or a no-horizontal-overflow check is not proof that spacing is correct.
- Preserve or add focused browser geometry assertions for spacing regressions. Run the relevant existing spacing/layout tests after changing these shared rules.

## Programming study notes

When the user supplies a programming concept or code snippet, create or update a study note:

- Save each note as a separate standard Markdown `.md` file with a descriptive,
  kebab-case filename. Group related notes in topic directories.
- Search existing notes first and update a relevant note rather than duplicating it.
- For an application session, use the session-scoped Markdown storage helpers and
  configured `STUDY_NOTES_DIR` (default `study-notes/`). For a standalone repository
  note without a session, use `notes/<topic>/<descriptive-filename>.md`.
- Begin with `# Title` and a concise explanation. Include `### Key Points`,
  `### Example`, and `### Reference`. Add `### Output` only when useful.
- Keep essential facts, behavior, and relevant differences concise. Use proper
  Markdown headings, lists, bold text, and inline code.
- Fence every code example with its correct language identifier. Put expected
  output in a separate `text` fence, never mixed into executable examples.
- Verify direct links to official documentation or reliable primary sources.
  Never invent documentation URLs or unsupported claims. Omit unnecessary sections.
- Preserve imported legacy notes verbatim; do not invent examples, outputs, or
  references to fill gaps in historical content.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
