# EduReels Agent Development Tracker

## Mission

Build the application described in [PRODUCT_SPEC.md](./PRODUCT_SPEC.md). Treat that document as the product source of truth. This file is the durable implementation checklist: update it as work is completed, and only mark an item done after the implementation and relevant verification exist in the repository.

## Current state

- [x] Requirements and staged roadmap documented.
- [x] Next.js/TypeScript web application scaffold and core learning/admin workflows exist in `web/`.
- [ ] Release 1 is not complete; SMTP delivery verification, several edit/admin workflows, and external services remain.

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
- [x] Add database connection, initial schema, and repeatable migrations. (Application routes/actions use the async Neon PostgreSQL layer; versioned Drizzle migrations are repeatable.)
- [x] Document local setup, required services, and first-admin provisioning.

Verification: `cd web && npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` passed for the Neon migration; the latest email-flow checks are recorded below.

### Phase 1 — Accounts and access control

- [ ] Implement student registration, login, logout, email verification, and password recovery. (Verification and single-use expiring recovery flows plus pages are implemented; live SMTP delivery remains unverified because no provider configuration is present.)
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
- Provider targets selected by the user: Neon PostgreSQL, SMTP email, Cloudflare Stream, and Vercel. Neon persistence and migrations are complete and verified. Remaining blockers: configure and verify SMTP, integrate Cloudflare Stream, finish the outstanding administration/testing/PWA work, then configure production secrets, backups, and Vercel deployment. No credentials have been supplied in chat or committed.
- 2026-11-12: Migrated application queries/actions from SQLite to Neon PostgreSQL; fixed PostgreSQL-specific aggregate queries; verified four tests (including the live Neon adapter integration test), lint, type-check, build, repeatable migrations, and authenticated admin/student HTTP routes. Latest auth work adds email verification and single-use, expiring password reset tokens; SMTP delivery remains blocked on provider configuration.
- 2026-11-12: Added `/verify-email`, `/forgot-password`, and `/reset-password` pages and registration/login navigation. `cd web && npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run db:migrate` passed; lint reported one unused import subsequently removed. SMTP messages were not delivered because SMTP credentials are absent.
- 2026-11-12: Added `npm run admin:reset-password`, a terminal-only administrator password reset that hides typed passwords, stores a bcrypt hash, revokes active sessions, and writes an audit record. Verified the script parses, `cd web && node --test src/lib/reel-progress.test.mjs` passes (3 tests), and `cd web && npm run lint && npm run typecheck` passes. Did not run a database write because the Neon credential was exposed in chat; rotate it before using the command.
