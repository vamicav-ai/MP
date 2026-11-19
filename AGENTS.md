# EduReels Agent Development Tracker

## Mission

Build the application described in [PRODUCT_SPEC.md](./PRODUCT_SPEC.md). Treat that document as the product source of truth. This file is the durable implementation checklist: update it as work is completed, and only mark an item done after the implementation and relevant verification exist in the repository.

## Current state

- [x] Requirements and staged roadmap documented.
- [x] Next.js/TypeScript web application scaffold and core learning/admin workflows exist in `web/`.
- [ ] Release 1 is not complete; several edit/admin workflows and external services remain.

## Product decisions to preserve

- Start with a responsive web app that can become an installable PWA. Do not start a separate native mobile application.
- Initial product: student accounts and learning dashboard, subjects, free and paid batches, full-length classes, sequential educational reels with saved progress, and role-based admin/teacher tools.
- An administrator creates and manages teacher accounts. Teachers can create and publish classes and reels.
- Collect payment offline in the first release. Record a student's payment as pending until an administrator verifies it; only then grant paid-batch enrollment. Do not add a Razorpay checkout or imply that payment was collected online.
- Razorpay is a later, separately tested release. Never grant access based solely on a browser-side payment success signal.
- Enforce permissions and paid-content access on the server, not only in the UI.
- Keep secrets out of source control. Use documented environment variables and a local example file with placeholders only.

## Build and verification rules

1. Read the relevant sections of `PRODUCT_SPEC.md` before implementing a feature.
2. Prefer small, working vertical slices; keep student, teacher, and admin permissions explicit.
3. Use migrations for schema changes and preserve referential integrity.
4. Add focused tests for permission boundaries, enrollment/payment confirmation, and reel progress behavior.
5. Run the smallest relevant test, lint, and type-check commands after each coherent change. Record the actual commands and outcomes in the checklist below.
6. Do not mark an external integration complete until it works against its supported test/sandbox flow. Do not claim production readiness without deployment and configuration checks.
7. If a product decision or required external credential is missing, document the blocker and ask before inventing a consequential behavior.
8. Never store real passwords, API keys, payment credentials, or personal data in fixtures, documentation, or commits.

## Roadmap and progress

Check items only when implemented and verified. Add concise verification notes under a phase when it is started or completed.

### Phase 0 — Foundation

- [x] Create the TypeScript web application scaffold and establish formatting, lint, type-check, and test commands.
- [x] Build a responsive application shell and public landing page.
- [x] Add environment-variable validation and a placeholder-only environment example.
- [ ] Add MongoDB Atlas connection, collection indexes, and database migration. (Atlas persistence, indexes, and the idempotent PostgreSQL importer are implemented; live Atlas connectivity is verified, but existing records still need importing.)
- [x] Document local setup, required services, and first-admin provisioning.

Verification: Atlas connectivity, transaction support, and application index creation are verified; importing existing PostgreSQL records remains pending a source connection string. Other foundation and account workflow checks are recorded below.

### Phase 1 — Accounts and access control

- [x] Implement student registration, login, logout, and password changes. (Registration signs students in without email; signed-in users change their password with their current password, while administrators reset forgotten passwords and revoke sessions.)
- [x] Implement student, teacher, and administrator roles with server-side authorization.
- [ ] Restrict student sessions to one registered browser/app installation at a time; document that browser identity is not proof of a physical device. (A server-side session limit exists; admin revocation and the limitation documentation remain.)
- [ ] Add focused authentication and role-authorization tests.

### Phase 2 — Subjects, batches, and offline payments

- [x] Let students select and later update their subjects.
- [ ] Let administrators create, edit, publish, and archive subjects and batches.
- [x] Support free-batch enrollment.
- [x] Support offline-payment requests and pending-payment status for paid batches.
- [x] Let administrators record payment verification details and confirm or reject a pending payment.
- [x] Grant paid-batch access only after server-side administrator confirmation.
- [ ] Test duplicate enrollment and unauthorized payment confirmation.

### Phase 3 — Teacher management and learning content

- [ ] Let administrators create, update, suspend, and deactivate teacher accounts. (Create and suspend/reactivate exist; edit/deactivate workflows remain.)
- [x] Let authorized teachers create and publish full-length classes.
- [ ] Let authorized teachers create, order, edit, and publish reels within a subject/topic series. (Create and publish exist; editing and reordering remain.)
- [x] Enforce permissions for content creation, publication, and video access.
- [ ] Integrate the selected video host only after its account, credentials, and upload/playback requirements are documented.

### Phase 4 — Student learning experience

- [x] Build the student dashboard, batch browsing, enrollment views, and subject-filtered content.
- [x] Build protected class playback and resumeable class progress.
- [x] Build the subject/topic reel feed and ordered reel player.
- [x] Persist reel progress and resume at the next incomplete reel.
- [x] Enforce the documented reel completion rule on the server using validated playback progress.
- [ ] Add focused tests for sequence changes, replay, resume, and access restrictions.

### Phase 5 — Administration and operations

- [ ] Build student, teacher, subject, batch, class, reel, and pending-payment management screens.
- [ ] Add student progress views, basic platform analytics, notifications, and audit records as defined in the product specification.
- [ ] Add rate limits and operational safeguards for authentication and sensitive actions.
- [ ] Verify that administrator actions are auditable and appropriately permission-gated.

### Phase 6 — Release readiness

- [ ] Make the application responsive and installable as a PWA.
- [ ] Complete end-to-end testing for student, teacher, and administrator journeys.
- [ ] Review accessibility, security, backups, error handling, and video access controls.
- [ ] Document production configuration and deploy to the selected hosting provider.
- [ ] Complete production smoke tests and record release limitations.

### Later release — Razorpay

- [ ] Confirm business account, supported payment methods, refund/settlement policy, and required credentials.
- [ ] Implement server-created orders and server-verified payment/webhook handling.
- [ ] Make payment processing idempotent and reconcile payment records with enrollments.
- [ ] Test success, failure, cancellation, duplicate webhook, refund, and reconciliation cases in the provider's test mode before enabling production payments.
- [ ] Keep offline payment records and online Razorpay transactions distinguishable in the admin interface and database.

## Verification log

- 2026-11-12: `cd web && npm test` passed (3 tests); `cd web && npm run lint`, `cd web && npm run typecheck`, and `cd web && npm run build` all passed after the landing page and reel-progress changes.
- 2026-11-12: Production smoke check passed: `DATABASE_PATH=/tmp/edureels-smoke.sqlite npm run start -- --hostname 127.0.0.1`; `curl` returned HTTP 200 for `/` and `/manifest.webmanifest`, and the landing page/manifest content was verified.
- 2026-11-12: Added local setup and first-admin instructions, placeholder `.env.example`, DB-path validation, a public landing page, and Node tests for reel progress/sequence behavior. Root-level npm commands fail as expected because the package manifest is in `web/`; run checks from that directory.
- 2026-11-12: Added Neon Serverless/Drizzle, a PostgreSQL schema and versioned initial migration. The `DATABASE_PATH` setting in the ignored local `.env` was detected as a PostgreSQL URL without displaying it. Neon connectivity (`SELECT 1`) succeeded; the additive schema migration created the application tables in the previously empty database and a repeat migration succeeded.
- Provider targets selected by the user: MongoDB Atlas, Cloudflare Stream, and Vercel. Email delivery is intentionally excluded. Atlas connectivity, transactions, and indexes are verified; the PostgreSQL-to-Atlas import is implemented but not run. Remaining blockers: import the existing records, integrate Cloudflare Stream, finish the outstanding administration/testing/PWA work, then configure production secrets, backups, and Vercel deployment. No credentials have been supplied in chat or committed.
- 2026-11-12: Migrated application queries/actions from SQLite to Neon PostgreSQL; fixed PostgreSQL-specific aggregate queries; verified four tests (including the live Neon adapter integration test), lint, type-check, build, repeatable migrations, and authenticated admin/student HTTP routes.
- 2026-11-12: Added account verification and email-based password recovery, later removed by the user's decision to keep the application email-free.
- 2026-11-12: Added `npm run admin:reset-password`, a terminal-only administrator password reset that hides typed passwords, stores a bcrypt hash, revokes active sessions, and writes an audit record. Verified the script parses, `cd web && node --test src/lib/reel-progress.test.mjs` passes (3 tests), and `cd web && npm run lint && npm run typecheck` passes. Did not run a database write because the Neon credential was exposed in chat; rotate it before using the command.
- 2026-11-12: Added `npm run admin:create` for the case where existing users prevent first-admin setup but no active administrator exists. It prompts for account details and hidden password, creates an admin with a bcrypt hash, and writes an audit record; it refuses creation when an active admin already exists. Script syntax/noninteractive guard, lint, type-check, and 3 focused tests passed. No database write was performed.
- 2026-11-14: Removed all email sending, verification, and email-recovery code; registration signs users in directly. Added current-password self-service changes and audited admin student resets with session revocation. `cd web && npm test` (4 tests), `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run db:generate` passed. HTTP smoke checks returned 200 for `/register` and `/forgot-password`, 307 for protected `/account` and `/admin/students`, and 404 for retired `/reset-password` and `/verify-email`. The generated `0004` migration was not applied to the configured database.
- 2026-11-14: Fixed `admin:create` prompt input by switching to promise-based readline; a pseudo-terminal test received the entered value. `cd web && npm test` (4 tests), `npm run lint`, and `npm run typecheck` passed. No account or database write was performed.
- 2026-11-16: Added the missing `@types/pg` development dependency after `npm run typecheck` failed to resolve declarations for `pg`. `cd web && npm test` passed (3 passed; Neon integration test skipped), `npm run lint`, `npm run typecheck`, and `npm run build` passed. Production smoke checks returned HTTP 200 for `/`, `/register`, `/forgot-password`, and `/manifest.webmanifest`, and 307 for protected `/account`, `/dashboard`, and `/admin`. `/login` returned HTTP 500 because the configured database points to unavailable local PostgreSQL at `127.0.0.1:5432`; the live integration test is therefore skipped. Production server was started on port 3000.
- 2026-11-16: Replaced application persistence and direct SQL queries with MongoDB Atlas collections, unique indexes, transactions, and numeric ID counters. Added `MONGODB_URI`/`MONGODB_DB` configuration, Atlas-based admin scripts, and a rerunnable importer that preserves data from the legacy PostgreSQL database. Updated the product/setup documentation and replaced the PostgreSQL integration test with Atlas/migration coverage. `cd web && npm test` passed (7 passed; opt-in Atlas test skipped), `npm run lint`, `npm run typecheck`, `npm run build`, and migration/admin script syntax checks passed. A live Atlas connection attempt failed during SRV DNS resolution before any write; no PostgreSQL source URL is configured, so the import remains unrun. Do not remove the source records.
- 2026-11-16: Started the production build after the Atlas rewrite on port 3000. Smoke checks returned HTTP 200 for `/`, `/register`, `/forgot-password`, and `/manifest.webmanifest`, and HTTP 307 for protected `/account`, `/dashboard`, and `/admin`. At that point, Atlas-backed login/data flows were blocked by an unresolved Atlas hostname.
- 2026-11-16: After Atlas credentials were corrected, `cd web && npm run test:atlas` passed. Production smoke checks initially exposed an invalid explicit unique `_id` index that blocked app initialization; removed the redundant index and added shared index creation to the live integration test. `cd web && npm run test:atlas`, `npm test` (7 passed, 1 opt-in test skipped), `npm run lint`, `npm run typecheck`, and `npm run build` passed. Restarted the production server on port 3000; `/`, `/register`, `/setup`, and `/manifest.webmanifest` return HTTP 200; `/login` redirects to `/setup` because the Atlas `users` collection is empty. Existing PostgreSQL records have not yet been imported.
- 2026-11-16: User created the initial administrator through `/setup`. Verified `/login` now returns HTTP 200 and `/setup` redirects to `/login`. Atlas connectivity and transactions are working; existing PostgreSQL records remain to be imported once `SOURCE_DATABASE_URL` is configured. The production app is running on port 3000.
