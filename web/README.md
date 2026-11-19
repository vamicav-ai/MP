# EduReels web app

The Next.js 16, TypeScript app provides student, teacher, and administrator workspaces. MongoDB Atlas stores application data; server-side authorization protects roles, payments, and learning progress.

The selected production targets are MongoDB Atlas, Cloudflare Stream, and Vercel. Atlas collections, indexes, and the PostgreSQL data importer are implemented. The Atlas connection and existing-data import still need to be run with valid local credentials. Protected video integration remains.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```sh
cd web
npm ci
npm run dev
```

Create a MongoDB Atlas cluster and database user, and allow the development machine's IP in Atlas Network Access. Use an Atlas cluster that supports transactions; payment confirmation/enrollment and administrative operations rely on them.

Set `MONGODB_URI` to the Atlas connection string and `MONGODB_DB` to the application database name in the ignored `web/.env` file. Use a least-privilege database user. Do not copy connection strings into command output, source files, or documentation.

In GitHub Codespaces, Server Actions allow the forwarded `localhost:3000` origin to account for the Codespaces proxy. This exception is enabled only when `CODESPACE_NAME` is set; other environments retain Next.js's default origin checks.

## Import existing PostgreSQL data

The one-time importer preserves numeric IDs, relationships, and timestamps for all application records. It reads from PostgreSQL and performs idempotent upserts into Atlas; it does not delete or modify the source database. Back up both systems first and use a dedicated Atlas database for the import.

Set `SOURCE_DATABASE_URL` in `web/.env` to the existing PostgreSQL connection string, along with `MONGODB_URI` and `MONGODB_DB`. Then run:

```sh
cd web
npm run db:migrate
```

The import is safe to rerun. It creates the required unique indexes and resumes ID counters after copying the records. The migration command prints collection record counts, not connection strings or personal data. Keep the source setting only as long as needed for migration, then remove it from the local environment.

## Accounts and email

On a new, empty Atlas database, open `/setup` once to create the first administrator. No default administrator credentials are shipped.

Registration does not require email verification, and the application does not send email. Signed-in users can change their password from **Account** by entering their current password. If they have forgotten it, an administrator can reset it from the student directory; the student should then change it after signing in.

If existing records were imported but there is no active administrator, use `npm run admin:create` from `web/`. It prompts for the name, email, mobile number, and password; password input is hidden. To reset an administrator password, use `npm run admin:reset-password`. Both commands connect to the configured Atlas database, hash passwords, revoke sessions when resetting, and write audit records. Never pass passwords as command-line arguments or commit them.

## Quality checks

Run these from `web/`:

```sh
npm test
npm run test:atlas
npm run lint
npm run typecheck
npm run build
```

`npm run test:atlas` is the opt-in live transaction test. It writes and removes a uniquely named temporary collection and requires an Atlas URI that resolves and supports transactions.

`npm run db:migrate` is the one-time PostgreSQL-to-Atlas data importer, not a schema migration runner. The app creates and validates Atlas indexes on initialization.

## Current limitations

- The application has no email delivery or email-based password recovery. Students who forget their password must contact an administrator.
- The single-session identifier is a browser/app-installation cookie; it can be cleared or changed and does not prove a physical device.
- Video playback currently accepts HTTPS video URLs. Cloudflare Stream uploads and signed playback are not integrated yet.
- Paid batches use offline collection requests and administrator verification. The application does not collect money online.
- Atlas connection and PostgreSQL-to-Atlas import have not been verified. Atlas settings are present in the local environment, but the configured SRV endpoint did not resolve during the connection test. No PostgreSQL source URL is currently configured; set an accessible `SOURCE_DATABASE_URL` before migrating existing records.
- Cloudflare Stream, Vercel, production backups, and deployment have not been configured or verified.

Keep real credentials in local environment files or a deployment secret manager. Never commit `.env`, `.env.local`, passwords, or provider credentials.
