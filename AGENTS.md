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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
