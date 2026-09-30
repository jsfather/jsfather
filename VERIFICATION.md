# Verification — September 30, 2026

Verified against the actual production standalone Next.js server at `http://localhost:3100` and a disposable local PostgreSQL 18 instance. No authentication bypass or alternate storage backend was added to the application.

| Check                                                    | Result                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| TypeScript (`npm run typecheck`)                         | Passed                                                            |
| ESLint (`npm run lint`)                                  | Passed without warnings                                           |
| Formatting (`npm run format:check`)                      | Passed                                                            |
| Production Next.js build (`npm run build`)               | Passed                                                            |
| Standalone production server (`PORT=3100 npm run start`) | Started and tested                                                |
| Drizzle migrations                                       | Both committed migrations applied; repeated application succeeded |
| Bundled migration runner (`node dist/migrate.cjs`)       | Passed against PostgreSQL                                         |
| Development seed                                         | Created real records; second run changed nothing                  |
| Business logic tests (`npm test`)                        | 47 passed                                                         |
| PostgreSQL integration (`npm run test:integration`)      | Passed                                                            |
| End-to-end browser tests (`npm run test:e2e`)            | 2 comprehensive scenarios passed                                  |
| Docker Compose configuration                             | Validated with `docker compose config -q`                         |
| Docker entrypoint shell syntax                           | Passed                                                            |
| Runtime dependency audit                                 | 0 vulnerabilities                                                 |
| Desktop/mobile visual review                             | Reviewed rendered screenshots; no mobile horizontal overflow      |

Business-logic tests cover local-time schedules, selected weekdays, DST boundaries and gaps, normalized session completion, weighted exam scoring, unanswered/foreign options, exact passing thresholds, grades, server input validation, ownership, and all 32 combinations of public profile/progress/course/score visibility.

PostgreSQL integration covers Auth.js adapter session persistence and revocation, course/session storage, generated schedules, completion persistence, the one-active-attempt constraint, grading and certificate transactions, and foreign-key cascade cleanup.

Browser tests cover real course creation, saved private notes, session completion, actual course/university progress, exam creation/publication, answering/reloading/submission, immutable result review, certificates, locked exam edits, late submissions receiving no credit, second-user read restrictions, replayed Server Actions rechecking the current user, private-course exclusion, independent public progress/score/certificate settings, privacy revocation, course edits/deletion, logout revocation, day/week/month navigation, mobile navigation, and theme persistence.

## Not verified externally

- A live Google OAuth authorization/callback round trip: no Google client credentials were provided. Database sessions, session revocation, invalid-session handling, and missing-configuration feedback were verified. Add the credentials and perform the documented Google round trip before launch.
- Building/running the Docker image: this workspace cannot access the Docker daemon. Its Compose configuration, shell entrypoint, standalone server, and bundled migration runner were checked separately.
- Deployment to Dokploy or `https://jsfather.ir`: no Dokploy server access or domain/DNS configuration was provided. Deployment instructions are in `README.md`.

The local database is disposable, has randomly generated credentials in ignored `.env.local`, and contains optional development seed records. It is not a provisioned production database. Browser test fixtures were removed after the tests.
