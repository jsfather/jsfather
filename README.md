# jsfather Personal University

A full-stack personal LMS for developers, built for **https://jsfather.ir**. Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, Zod, and Auth.js with Google OAuth and persistent database sessions.

## What is implemented

- Rename the university directly in the wordmark without signing in. Focus starts editing with the caret at the end. The browser stores the name locally and synchronizes it across tabs, including the browser tab title while preserving each page’s title. Enter or blur saves; Escape cancels; an empty name restores `jsfather`.

- Google sign-in, sign-out, persistent sessions, and private-by-default profiles.
- User-owned course creation, editing, archiving, and confirmed deletion.
- Automatic session generation using chosen weekdays, start date, class time, duration, and IANA timezone. Class times remain local across daylight saving changes; nonexistent local times are rejected.
- Session rescheduling, private notes, completed/skipped/in-progress states, and one-click completion.
- Dashboard with today's classes, overdue/upcoming sessions, course progress, study time, and university-wide statistics.
- Day, week, and month timetables linking to session details.
- Exam authoring with multiple-choice/true-false questions, weighted points, question ordering, configurable pass threshold, drafts, and publication.
- Timed attempts, previous/next navigation, device-local answer recovery, automatic submission, server-side scoring, immutable result reviews, and multiple attempts.
- Transactionally issued achievement certificates after each passing attempt, with a printable certificate page. Browser printing can save a PDF; dedicated PDF generation is intentionally deferred.
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

The optional seed creates a user, 25 scheduled Advanced JavaScript sessions, and a published final exam with two questions. Defaults to `keyvan@example.test`, which cannot authenticate through Google. For a usable development seed, set `SEED_EMAIL` to your Google address. Seeding an existing owner with courses changes nothing. The seed and integration scripts refuse `NODE_ENV=production`.

Session status, notes, and completion time are the normalized session-progress record. A separate progress table is unnecessary for a single-owner course; percentages, completed courses, and aggregates are derived from sessions and attempts. Course `totalSessions` is the creation configuration; actual progress counts stored sessions. Attempt reviews and certificate names/titles are intentional immutable snapshots. Exams cannot be edited after any attempt starts, keeping timed attempts and grades consistent.

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
npm run test:integration   # Real PostgreSQL, existing migrated test DB; never production.
npm run build
PORT=3100 npm run start    # Keep this running in another terminal.
npx playwright install chromium
npm run test:e2e
```

Use a disposable test database. Integration tests create only uniquely identified fixture users and remove them with cascading cleanup. Browser tests create real database sessions through test setup; the application has no endpoint to create them without OAuth. They verify course creation, session notes/completion, progress, exam authoring and taking, result reviews, certificates, deletion, logout, responsive navigation, theme persistence, anonymous restrictions, second-user ownership, and independent public/privacy settings. OAuth itself requires the manual Google round trip described above.

For a restricted environment, set `PLAYWRIGHT_BROWSERS_PATH` to a writable temporary directory for both installation and tests. The test suite's no-Google-credentials case assumes the local test server has no provider credentials; it does not exercise the real Google service.

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

Every private read and mutation checks the current session and resource ownership on the server. Private resources are unavailable to other users. Public profiles require `publicProfile`; public courses require `showCourses` and individual `isPublic`; progress requires `publicProgress`; exam scores and public certificates additionally require `showExamScores`. Public statistics cover only public courses. Session descriptions/notes, schedules, email, OAuth tokens, and exam answer keys are never part of public views. The take-exam component receives only question text, point values, and answer options, without correctness/explanations. Private routes are dynamic and not indexed by search engines.

The MVP intentionally omits social feeds, subscriptions, reminders, attachments, advanced question types, and official academic certification. Those can be added without weakening the existing ownership boundary.
