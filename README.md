# jsfather Personal University

A full-stack personal LMS for developers, built for **https://jsfather.ir**. Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, Zod, and Auth.js with Google OAuth and persistent database sessions.

## What is implemented

- Rename the university directly in the wordmark without signing in. Focus starts editing with the caret at the end. The browser stores the name locally and synchronizes it across tabs, including the browser tab title while preserving each page’s title. The initial page reserves space until the saved name is available, and the tab title is personalized before React loads. Enter or blur saves; Escape or an empty name keeps the latest saved name.

- Google sign-in, sign-out, persistent sessions, and private-by-default profiles.
- User-owned course creation, editing, archiving, and confirmed deletion.
- Automatic session generation using chosen weekdays, start date, class time, duration, and IANA timezone. Class times remain local across daylight saving changes; nonexistent local times are rejected.
- Session rescheduling, private notes, completed/skipped/in-progress states, and one-click completion.
- Dashboard with today's classes, overdue/upcoming sessions, course progress, study time, and university-wide statistics.
- Day, week, and month timetables linking to session details.
- Exam authoring with multiple-choice/true-false questions, weighted points, question ordering, configurable pass threshold, drafts, publication, safe fenced-code highlighting, and long-form question content.
- Timed attempts, previous/next navigation, device-local answer recovery, automatic submission, server-side scoring, immutable result reviews, and multiple attempts.
- Class question banks need no exam title or description. Eight auto-graded types: single choice, multiple answers, true/false, short answer, single blank, numeric with tolerance, ordering, and matching. Typed answers use accepted alternatives, Unicode/whitespace normalization, and optional case sensitivity; they are not semantic essay grading. Multiple-answer, matching, and ordering questions use exact answers without partial credit.
- Easy/medium/hard defaults are 1/2/3 points and 60/90/180 seconds per question. Authors can override each. Total time sums question budgets and rounds up to minutes; the assessment uses one overall timer, not individual question cutoffs. Suggested passing score is the point-weighted average of 80/70/60% mastery targets. This is a transparent personal-study heuristic, not a validated standard-setting study. Authors can override total time and passing score for future attempts. Each new attempt snapshots its questions, key, time limit, and threshold; subsequent edits preserve active attempts and previous grades. Older unfinished attempts without a snapshot must finish before editing their bank.
- The Assessment section at the bottom of a course provides Practice and Final assessment. Each generates a fixed snapshot of all questions from the course’s session exams and immediately starts a saved attempt. Generated assessments are never included in future question pools. There is no automatic final generation.
- Certificates require passing a course final at its configured threshold and completing every class, in either order. Completing the last class issues a certificate for a previously passed course final. Class practice never awards a course certificate. Existing certificates remain intact.
- Course and session exams can be published at `/practice/[id]` and explored at `/practice`, with Course exam and Session exam tags and scope filters. Signed-in visitors get saved practice attempts and a history; they cannot manage the owner’s exam or earn the owner’s course certificate. Anonymous visitors get timed practice and result review. Guest attempts, answers, scores, and certificates are never written to the database or browser storage. A server-encrypted, authenticated assessment snapshot holds the answer key and deadline; disabling publication prevents guest submission.
- Public profiles at `/u/username`, public courses, and independently controlled learning progress, exam scores, and certificate visibility.
- Responsive navigation, dark/light themes, loading/error/empty states, validation feedback, metadata, robots, sitemap, and database health checks.

There are no password accounts, authentication bypasses, client-side mock databases, or sample records used as a fallback. The landing page's sample syllabus is explicitly an illustration. Actual dashboards always query the authenticated user's PostgreSQL data.

## Requirements

Node.js **24 LTS**, npm, and PostgreSQL **17+**. Docker is optional for local development and supported for deployment. The lockfile pins dependencies, including the Auth.js v5 beta required by its App Router integration. Review upstream releases before upgrades.

## Local development

```sh
npm ci
cp .env.example .env.local
# Fill .env.local with database and Google credentials.
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Without Google credentials, the landing page works and sign-in shows a configuration message. Private pages require a valid authenticated session.

For a local database using Docker:

```sh
docker run --name jsfather-postgres \
  -e POSTGRES_USER=jsfather \
  -e POSTGRES_PASSWORD=choose-a-strong-password \
  -e POSTGRES_DB=jsfather \
  -p 127.0.0.1:5432:5432 \
  -v jsfather-postgres-data:/var/lib/postgresql/data \
  -d postgres:17-alpine
```

Set `DATABASE_URL=postgresql://jsfather:YOUR_URL_ENCODED_PASSWORD@localhost:5432/jsfather`.

For disposable development/testing without Docker, **before creating `.env.local`**, run `npm run db:dev`. This starts an actual local PostgreSQL process on port 55432 and writes a randomly generated database password and Auth secret to `.env.local`. Keep the process running, run migrations in another terminal, and add Google credentials if you need to sign in. This is a development tool only; the database is deleted when the process stops. Remove or replace its `.env.local` afterwards. It refuses to overwrite an existing database configuration.

## Environment variables

| Variable               | Purpose                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string. Use the internal Dokploy URL in production.                                        |
| `AUTH_SECRET`          | Random session/OAuth signing secret. Generate with `openssl rand -base64 32`.                                    |
| `GOOGLE_CLIENT_ID`     | Google OAuth web application client ID.                                                                          |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret; server-only.                                                                         |
| `NEXT_PUBLIC_APP_URL`  | Canonical application origin: `https://jsfather.ir` in production. Also supplied as a Docker build argument.     |
| `AUTH_URL`             | Auth.js origin, `https://jsfather.ir` in production. Include no trailing slash.                                  |
| `AUTH_TRUST_HOST`      | `true` behind Dokploy's trusted reverse proxy. Only route trusted hostnames to this application.                 |
| `POSTGRES_PASSWORD`    | Used only by `compose.yaml`, for its database service. Use a URL-safe random value, e.g. `openssl rand -hex 32`. |
| `SEED_EMAIL`           | Optional development seed owner; use your Google email to access seed courses after sign-in.                     |
| `PORT`                 | Optional local production server port; defaults to 3000.                                                         |
| `TEST_BASE_URL`        | Optional browser-test origin; defaults to `http://localhost:3100`.                                               |

Never commit `.env.local` or pass secrets as Docker build arguments. Database connections are lazy, so production builds require no database or OAuth credentials. The Docker entrypoint requires runtime credentials and `AUTH_URL`, applies migrations, and then starts the server.

## Google OAuth setup

1. Create a Google Cloud project and configure its OAuth consent screen. Choose External if accounts outside your organization will sign in.
2. Add yourself as a test user while the consent screen is in Testing. Configure only basic profile/email access; Gmail mailbox access is not requested.
3. Create an OAuth client of type **Web application**.
4. Add authorized JavaScript origins:
   - `http://localhost:3000` for local development.
   - `https://jsfather.ir` for production.
5. Add authorized redirect URIs, exactly:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://jsfather.ir/api/auth/callback/google`
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET`. Match `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the chosen origin. If developing on another port, register that exact origin and callback URI.
7. Publish the consent screen when ready for general access, following Google's requirements. Open the landing page and complete an actual Google sign-in. Verify that refreshing stays signed in and that sign-out removes the session.

OAuth account linking uses Auth.js defaults; unsafe automatic email linking is not enabled. Authentication uses its CSRF, state/PKCE, HttpOnly cookies, and database session handling. Live Google authorization needs real credentials and cannot be completed by automated tests using fixture sessions.

## Database schema, migrations, and seed

```sh
npm run db:generate    # Generate a versioned SQL migration after a schema change.
npm run db:migrate     # Apply committed migrations; safe to repeat.
npm run db:seed        # Optional, development only.
npm run db:studio      # Local database inspection; keep it off the public internet.
```

The initial migration is committed under `drizzle/`. Migration startup takes a PostgreSQL advisory lock, serializing multiple application replicas. Back up the database before deploying schema changes. Migrations run before the app starts; failed migrations prevent startup. For incompatible future changes, use an expand/migrate/contract rollout and keep the old app compatible during deployment.

The optional seed creates a user, 25 scheduled Advanced JavaScript sessions, and two practice questions attached to the first class. The practice bank is private until the owner enables its public link. Defaults to `keyvan@example.test`, which cannot authenticate through Google. For a usable development seed, set `SEED_EMAIL` to your Google address. Seeding an existing owner with courses changes nothing. The seed and integration scripts refuse `NODE_ENV=production`.

Session status, notes, and completion time are the normalized session-progress record. A separate progress table is unnecessary for a single-owner course; percentages, completed courses, and aggregates are derived from sessions and attempts. Course `totalSessions` stays synchronized with the stored sessions. Attempts snapshot their question keys and settings; reviews and certificate names/titles are also immutable snapshots. Class banks remain editable, while generated practice and final assessments keep fixed question snapshots. Deleting an assessment requires its exact generated title and removes its questions, attempts, and related certificates through database cascades.

All exam question/option writes and generated sessions are transactional. Passing an attempt and issuing its certificate happen in a single transaction. A partial unique index permits only one unfinished attempt per user and exam. Repeated submission of an already-submitted attempt does not grade again or issue another certificate. The server enforces the time limit; submissions beyond a 15-second network grace window receive no answer credit. Passing uses the exact weighted ratio rather than a rounded display percentage.

## Production build and start

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run build:migrate
npm run start
```

`npm run start` prepares public/static assets and runs Next.js's standalone server. For a custom local port, use `PORT=3100 npm run start`. Build output is excluded from source control. The standalone server serves the complete application, including Server Actions, OAuth endpoints, and public pages.

## Docker: two services

```sh
# Create .env for Docker Compose and set the values from .env.example.
# Use production origins and a URL-safe POSTGRES_PASSWORD.
docker compose --env-file .env up --build -d
```

`compose.yaml` defines exactly **web** and **postgres**, a persistent database volume, database readiness checks, and web startup migrations. PostgreSQL has no published port. Web binds to localhost:3000 for use behind a reverse proxy. Do not remove the database volume when upgrading.

To build and run web separately with an existing PostgreSQL:

```sh
docker build --build-arg NEXT_PUBLIC_APP_URL=https://jsfather.ir -t jsfather-university .
docker run --env-file .env.production -p 127.0.0.1:3000:3000 jsfather-university
```

This image runs as a non-root user, contains a bundled migration runner, and excludes dev tooling from its runtime. Use the same database network as your PostgreSQL service. `/api/health` returns 200 when the database is reachable and 503 otherwise, with no credentials or internal errors in its response.

## Dokploy deployment at jsfather.ir

### Recommended: application plus managed PostgreSQL

1. Create a Dokploy project and a PostgreSQL service. Choose PostgreSQL 17+, a dedicated database/user, a strong password, and persistent storage. Enable scheduled backups and confirm a restore works.
2. Deploy the database. Copy its **Internal Connection URL**; do not expose a public database port.
3. Add an Application service from this repository and select **Dockerfile** as the build type. Dockerfile path: `Dockerfile`; context: repository root. Set build argument `NEXT_PUBLIC_APP_URL=https://jsfather.ir`.
4. Add runtime environment values:
   ```env
   DATABASE_URL=the-internal-connection-url-from-dokploy
   AUTH_SECRET=your-random-secret
   GOOGLE_CLIENT_ID=your-google-web-client-id
   GOOGLE_CLIENT_SECRET=your-google-web-client-secret
   NEXT_PUBLIC_APP_URL=https://jsfather.ir
   AUTH_URL=https://jsfather.ir
   AUTH_TRUST_HOST=true
   ```
5. Connect the application to the PostgreSQL service's internal network. Deploy. The entrypoint automatically applies migrations and starts Next.js. Inspect deployment logs and check `/api/health`.
6. In your DNS provider, point the `jsfather.ir` **A record** at the Dokploy server. Only add an AAAA record if IPv6 routing is configured.
7. In the application's Domains tab add host `jsfather.ir`, path `/`, container port **3000**. Enable **HTTPS** with **Let's Encrypt**. Preserve the full request path; do not strip or rewrite `/api/auth`.
8. Confirm HTTPS is working. Configure Google's exact production callback URI as above. Complete a real Google login and a course/session/exam flow before launch.
9. Redeploy after environment changes. Keep `AUTH_SECRET` stable so deployments do not invalidate OAuth state unexpectedly. Keep the database volume and backups outside the web container.

### Alternative: Dokploy Docker Compose

Deploy `compose.yaml` with its environment values, then use Dokploy's Domains tab to route `jsfather.ir` to service `web`, port 3000, with HTTPS. Dokploy manages Traefik routing; use its network/isolation settings to make the web service reachable. The two services remain web + PostgreSQL. Do not enable an external PostgreSQL port.

Official references: [database connections](https://docs.dokploy.com/docs/core/databases/connection), [application domains](https://docs.dokploy.com/docs/core/domains), [Compose domains](https://docs.dokploy.com/docs/core/docker-compose/domains), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Auth.js Drizzle adapter](https://authjs.dev/getting-started/adapters/drizzle), and [Google provider](https://authjs.dev/getting-started/providers/google).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:session-exam-migration # Disposable PostgreSQL; verifies duplicate consolidation.
npm run test:integration   # Real PostgreSQL, existing migrated test DB; never production.
npm run build
PORT=3100 npm run start    # Keep this running in another terminal.
npx playwright install chromium
npm run test:e2e
```

Use a disposable test database. Integration tests create only uniquely identified fixture users and remove them with cascading cleanup. Browser tests create real database sessions through test setup; the application has no endpoint to create them without OAuth. They verify course creation, session notes/completion, progress, exam authoring and taking, result reviews, certificates, deletion, logout, responsive navigation, theme persistence, anonymous restrictions, second-user ownership, and independent public/privacy settings. OAuth itself requires the manual Google round trip described above.

For a restricted environment, set `PLAYWRIGHT_BROWSERS_PATH` to a writable temporary directory for both installation and tests. The test suite's no-Google-credentials case assumes the local test server has no provider credentials; it does not exercise the real Google service.

Each session has one exam with no fixed question-count cap. Adding questions reopens its existing question bank. Migration `0007_single_session_exam` merges older duplicate banks, retaining questions, options, results, and active attempt snapshots. If the same learner has multiple active attempts for a session, finish the overlapping attempts before applying that migration. Course finals remain separate assessments. From the course page, add sessions; from each session, edit its details or remove it and manage its attached exam. The course count and end date update automatically, including when the last session is removed.

## Vocabulary courses

Choose **Create course → Language vocabulary** to create a word-based course without scheduled sessions. Add each word or phrase with its explanation, an optional example, entry date, and easy/medium/hard difficulty. The daily word list groups entries by date.

Practice shuffles due words and randomly asks you to recall either the word or its meaning. Reveal the answer, then choose **Remembered** or **Review again**. Mastery requires 5/10/15 successful recalls for easy/medium/hard words. Successful recalls increase the spacing (easy starts at 2 days, medium at 1 day, hard at 12 hours), up to 30 days. Forgotten words return after 10 minutes and do not earn a successful repetition. Mastered words leave the due queue. These are transparent study defaults, not a standardized or validated learning algorithm.

Add an existing account by its exact username under **Collaborators**. The course appears in that learner’s My courses, with separate progress and saved reviews. Collaborators cannot change the word list or course settings and can leave the course themselves. Removing access takes effect on server reads and review submissions; completed review records are preserved if the learner is added again. Changing a word or its meaning resets mastery for everyone while preserving completed review history. Removing a word permanently removes its review records, with typed confirmation.

Apply migration `0010_vocabulary_courses` with `npm run db:migrate` before running this version against an existing database. Existing courses remain scheduled courses.

## Book reading courses

Choose **Create course → Reading a book**, enter its title, optional author, category, and total pages. Update **Last page read** to track pages read and remaining. Book courses have no timetable. Reading notes and bookmarks (page, label, and optional notes) are private, even for public courses.

Use **Manage questions** to add the same question types as regular courses. Practice and final assessments include all book questions and save their results. A certificate requires finishing all pages and passing the final; completing either requirement first is supported. Page counts cannot be reduced below an existing bookmark or reading position.

Apply migration `0016_book_reading_courses` with `npm run db:migrate` before running this version against an existing database.

## Daily streaks, focus minutes, and XP

Practice for **5 minutes per local day** across any course type to maintain one shared streak. Yesterday's streak remains available until today's midnight; an unqualified missed day breaks the current streak, while the best streak is retained. The dashboard and **Practice history** show today's estimated time, the last seven days, daily history, and time by course. Profile timezone determines day boundaries, including daylight-saving transitions.

A **focus minute** is 60 seconds of estimated learning time and earns **1 XP**. No practice timer is required: each rated vocabulary review earns 30 seconds (including “again”), each newly read book page earns 2 minutes when progress is saved, and completing a standard session credits its saved duration once. Submitted signed-in exams credit elapsed attempt time capped at the exam limit. An open tab alone earns nothing.

Outcome keys make awards transactional and idempotent. A book’s furthest credited page prevents repeat saves or moving backwards/forwards from farming XP. Completed session estimates remain fixed after their first award, including if the session is reopened or its duration is edited. Estimates are credited on the save date in the learner’s profile timezone. Historical measured time is preserved. Migration `0019_automatic_practice` imports saved outcomes only for course/activity combinations without previous measured time, adds zero-credit keys for those already measured, and initializes book high-water marks. Deleting courses preserves lifetime XP. The former timer API returns 410 so stale tabs cannot award extra measured time.

Public profiles show streak, XP, estimated time, a 28-day activity calendar, and earned milestones only when progress sharing is enabled. These stats include only public courses, and respect the separate exam-score setting.

The existing reminder endpoint sends one additional reminder per device after **9 PM** in the profile timezone when the five-minute goal is incomplete and an active course is available. It skips completed goals, retries transient delivery failures, and removes expired subscriptions. Enable **practice reminders** in Settings. Background delivery requires the Web Push keys and external scheduler described below; the app does not run its own scheduler.

Apply migrations with `npm run db:migrate` before running this version against an existing database (`0017_absurd_liz_osborn` adds the practice ledger; `0018_practice_exam_time` links exam timers to their attempt; `0019_automatic_practice` migrates automatic estimates).

## Architecture

- `src/app`: Server Components, route layouts, metadata, and useful API endpoints (Auth.js and health).
- `src/components`: Shared UI plus narrowly scoped client components for interactive forms, theme/navigation, and exams.
- `src/db/schema.ts`: Relational schema, enums, foreign keys, constraints, and indexes.
- `src/lib/auth.ts`: Google OAuth and session access.
- `src/lib/data.ts`: Owner-filtered data access, aggregates, pagination, public projections.
- `src/lib/validation.ts`: Server input schemas.
- `src/lib/learning.ts`: Scheduling, weighted scoring, progress, grades, and privacy policy.
- `src/actions`: Validated, authenticated mutations, transactions, and cache invalidation.
- `drizzle`: Committed SQL migrations and snapshots.
- `scripts`, `tests`: Deployment utilities, optional development seed, and critical verification.

Every private read and mutation checks the current session and resource ownership or vocabulary membership on the server. Private resources are unavailable to other users. Vocabulary collaborators can read and review their shared courses; only the owner can manage words, settings, or collaborators. Public profiles require `publicProfile`; public courses require `showCourses` and individual `isPublic`; progress requires `publicProgress`; exam scores and public certificates additionally require `showExamScores`. Public statistics cover only public courses. Session descriptions/notes, schedules, email, OAuth tokens, and exam answer keys are never part of public views. The take-exam component receives only question text, point values, and answer options, without correctness/explanations. Private routes are dynamic and not indexed by search engines.

The app currently omits social feeds, paid subscriptions, attachments, and official academic certification. Those can be added without weakening the existing ownership boundary.

Assessment names include the full course name: `Course final assessment`, `Course practice assessment`, and `Course Session practice assessment`. Course and session renames update their assessment names. Migration `0011_assessment_names` updates existing exams without changing questions or attempts.

All deletion and removal controls open a shared confirmation dialog. Copy the displayed value and paste it into the confirmation field; Confirm stays disabled until it matches exactly. Cancel, Escape, or the close button dismisses the dialog. Question editor removals update the draft and take effect when the exam is saved.

University names are saved on signed-in accounts and shared across their browsers. Guests keep a separate name in local browser storage. Rename by clicking the brand text or pencil; Enter or blur saves, Escape cancels. The rest of the brand links home. The book logo is available at `public/logo.svg` and also used as the favicon. Apply migration `0012_university_names` before starting this version against an existing database.

### Phone installation and vocabulary notifications

The app includes a standalone web manifest, regular and maskable PNG icons, an
Apple touch icon, and a root-scoped service worker. Serve production over HTTPS.
Android browsers that expose an install prompt show an Install app action;
iPhone/iPad users see Share → Add to Home Screen instructions. Installation is
also explained in Settings. The offline screen helps users reconnect; authenticated
pages and API responses are never cached for offline use.

Vocabulary due counts appear on the dashboard. Users can enable or disable Web
Push in Settings for each device. On iOS/iPadOS 16.4+, launch the installed Home
Screen app before enabling notifications. Permission is only requested when the
user presses Enable practice reminders.

To enable background reminders:

1. Run `npm run db:migrate` to create `push_subscriptions`.
2. Generate a stable VAPID key pair with `npx web-push generate-vapid-keys` and set
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a contact mailto or
   HTTPS URL). Keep the private key on the server; rotating keys requires devices
   to subscribe again.
3. Set `CRON_SECRET` to a cryptographically random secret (for example,
   `openssl rand -hex 32`).
4. Configure your hosting scheduler to POST to
   `/api/cron/vocabulary-reminders` every 15 minutes with the header
   `Authorization: Bearer <CRON_SECRET>`. This endpoint does not run on its own.
   Retry non-2xx responses. Do not expose the secret to the browser.

The first eligible run after 09:00 in the user's profile timezone sends at most
one notification per device per local day. Counts are calculated at delivery time
from active owned/joined vocabulary courses, excluding mastered or future-due
words. Unreviewed words are “to learn”; previously reviewed words are “to review”.
Empty queues send nothing. Expired subscriptions are removed; transient delivery
failures can be retried. Phone settings and push-service availability affect
actual delivery. A scheduler outage delays reminders until the next eligible run.

The same endpoint also checks the five-minute practice goal after 21:00 in the
profile timezone. It independently claims one streak reminder per device/day and
sends it only when the goal is incomplete and an active course is available.
Notifications expire by the user's midnight. No additional scheduler is needed.

### Academic vocabulary and public enrollment

Vocabulary course settings now include **Public course**. With the owner's public
profile and Show courses enabled, anyone can sign in and join from the public
course page. Enrolled learners have separate review progress. Adding an enrolled
learner by username promotes them to collaborator; existing invitations remain
collaborators after migration.

Owners and invited collaborators see the same ten suggested words on each course
calendar day, using the course timezone and start date. Suggestions rotate through
words ordered by AWL sublist and spelling, independently of individual mastery or
review timing. Personal spaced reviews remain separate.

The bundled Academic Word List contains all 570 headword families and 2,539 related
forms from https://www.eapfoundation.com/vocab/academic/awllists/, with authored
Persian glosses. Related forms are stored within each family rather than duplicated
as inflection flashcards. Each family includes معنی فارسی, AWL sublist, related
forms, source URL, and the existing meaning, example, and difficulty fields. Persian
glosses describe common senses, rather than every possible meaning in context.

Apply migration `0014_rare_runaways`, then import into an existing vocabulary course:

```sh
npx tsx scripts/import-academic-word-list.ts --course-id=YOUR_COURSE_ID --publish
```

The transaction inserts missing headwords, preserves existing content and progress,
and publishes only the specified course when `--publish` is present. Repeating it
is safe. It does not alter the owner's profile privacy settings.

### English and Persian pronunciation guides

Vocabulary entries now have editable US English IPA and approximate Persian
pronunciation guides. All 570 bundled AWL headwords have pronunciations derived
from the [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict), with
its license preserved in `public/licenses/cmudict.txt`. Multiple pronunciations
are retained. Persian guides use syllable separators and «» for primary stress;
English audio is the reference for sounds without a Persian equivalent.

Pronunciation and normal/slow English playback appear on daily suggestions and
library cards. Revealing a practice answer also displays pronunciation and every
related word form. Meaning-to-word prompts keep these hidden until reveal.
Playback uses the device's English Web Speech voices, with visible feedback when
unsupported or unavailable; it does not read the Persian transliteration aloud
as if it were native English speech.

After applying migration `0015_safe_arachne`, populate missing pronunciations for
an existing AWL course without resetting progress or overwriting edited guides:

```sh
npx tsx scripts/import-academic-word-list.ts --course-id=YOUR_COURSE_ID --pronunciations
```

To rebuild the bundled guides from an updated CMUdict file, run
`python3 scripts/data/build-awl-pronunciations.py /path/to/cmudict.dict`.

### Video course chapters and lesson recall

Regular courses support **Course → Chapter/folder → Session/video**. Existing
sessions remain ungrouped. On a course, add a chapter, open it, then expand
**Add videos to this chapter** and paste one video title per line (up to 100).
Each video becomes an independent session; the default duration is editable and
its initial schedule is today. Adjust individual schedules and move existing
sessions using **Chapter / folder** in the session form. Chapter filters retain
pagination, and chapter cards show completion across all their sessions.

Each session retains private study notes and its existing practice question bank.
**Review this lesson** records key points recalled from memory, open questions,
and understanding. Reveal notes and the latest 20 reviews after recalling;
previous reviews stay saved. Confidence is a self-assessment, independent of
completion and exam scores. Use **Add or edit practice questions** on a session
with an assessment, or **Add exam** to create its question bank.

Apply migration `0022_nifty_sleepwalker` before running this version. It adds
chapters, optional chapter assignments, and review history without rewriting
existing sessions or notes. The database rejects assignments to another course's
chapter. Schedule rebuilds are blocked once a session has a chapter or review,
to preserve the course outline and learning history.

### Multiple Markdown notes per session

Each regular-course session now has a **Study notes** panel supporting multiple
independent `.md` files. Choose a descriptive kebab-case filename and optional
nested topic folders, write or paste Markdown, preview it, and save. Each file can
be edited, downloaded, or deleted separately. Duplicate paths and stale edits
are rejected so a second browser tab cannot silently overwrite newer work.

Notes use `# Title`, a short explanation, `### Key Points`, `### Example`, and
`### Reference`. Code fences need a language identifier; optional expected output
belongs in a separate `text` fence. The starter template contains no fabricated
source link: supply a verified direct primary-source URL. The app checks the
structure, not the accuracy or authority of a source. Markdown previews support
headings, lists, inline code, GFM tables, and highlighted code; raw HTML is ignored.

Markdown files are the source of truth on the server, stored beneath
`STUDY_NOTES_DIR` (default `./study-notes`). Private account, course, and session
scope directories use stable hashes, followed by readable topic directories and
filenames, for example `<account>/<course>/<session>/javascript/closures.md`.
This directory is excluded from the application repository and Docker build
context. It can have its own private Git repository or file backups. Stop app
writers before restoring/editing a storage backup outside the application.

**Persist and back up the files as well as PostgreSQL.** Pause app writers when taking a coordinated backup. `compose.yaml` mounts
`study-notes-data` at `/app/study-notes`; do not remove this volume on upgrades.
For a Dokploy Dockerfile deployment, add a persistent volume at `/app/study-notes`
and set `STUDY_NOTES_DIR=/app/study-notes`. It must be writable by UID/GID 1001.
Multiple application instances must share this same durable filesystem; an
instance's ephemeral container filesystem is not sufficient.

On first opening a session, existing single-field notes are copied to
`imported-study-notes.md` before the old database field is cleared. An interrupted
import is safe to retry and never overwrites an existing imported file. Original
text is preserved without inventing missing study content. Session/course deletion
also removes its Markdown files; note deletion requires confirmation. Timetable
rebuilds are blocked while the course has saved Markdown notes.

### Per-word vocabulary history

Word-library entries and recall cards show your personal **Shown in practice**,
**Successful**, and **Failed** counts from saved review records. Shown includes a
pending unanswered card; revealing or reloading that same card does not add
another showing. Daily suggestions and library views are not counted as practice
cards. Successes and failures are historical outcomes, separate from current
mastery progress, so a progress reset does not erase the recorded history.

### Study notes workspace

Study notes lead the session page, before practice, recall reviews, and settings.
Use **Open notes workspace** from a session to read its notes together, or open
**Study notes** in the navigation for your collection across all regular courses.
Search note text and code, filter by course/session/topic, and read up to 12 full
notes per page. Filters remain in the URL. On larger screens a contents panel
jumps between the notes on the current page. Notes can be edited, downloaded, and
deleted from the workspace using the same private Markdown files as session pages.
Legacy single-field notes are imported when encountered in the collection.
