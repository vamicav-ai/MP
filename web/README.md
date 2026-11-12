# EduReels web app

The current application is a Next.js 16, TypeScript web app with student, teacher, and administrator workspaces. It uses Neon PostgreSQL, server-side role checks, offline payment verification, and resumable class/reel progress.

The selected production targets are Neon PostgreSQL, SMTP email, Cloudflare Stream, and Vercel. The Neon schema and application database access are configured; email and protected video integrations remain.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```sh
cd web
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first launch, the one-time setup page lets you create the first administrator. Choose a unique email and a strong password of at least 12 characters. No default administrator credentials are shipped.

Set `DATABASE_URL` in the ignored `web/.env` file to your Neon PostgreSQL connection string. For backwards compatibility, `DATABASE_PATH` containing a PostgreSQL URL is also accepted; new configurations should use `DATABASE_URL`.

Registration verification and password recovery require the `SMTP_*` settings shown in `.env.example`. Set `APP_URL` to the application's HTTPS origin in production; development defaults to `http://localhost:3000`. If SMTP is not configured, registration and recovery email cannot be delivered.

## Quality checks

Run these from `web/`:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Drizzle schema and migration commands (PostgreSQL). Migrations are repeatable and have been applied to the configured Neon database:

```sh
npm run db:generate
npm run db:migrate
```

If the database already has users but no administrator, first ensure the database connection string is current in `web/.env`, then run `npm run admin:create` from `web/`. It prompts for the name, email, mobile number, and password; password input is hidden. It stores a bcrypt hash and writes an audit record. The command refuses to create another account if an active administrator already exists.

To securely reset an existing administrator's password, run `npm run admin:reset-password` from `web/`. The command prompts for the admin email and new password without echoing the password, stores a bcrypt hash, revokes that administrator's active sessions, and writes an audit record. Never pass passwords as command-line arguments or commit them.

The Neon connection check passed using the local `.env` setting. Do not copy connection strings into command output, source files, or documentation.

## Current limitations

- Email verification and password recovery flows are implemented, but actual SMTP delivery has not been verified because no SMTP provider settings are configured.
- The single-session identifier is a browser/app-installation cookie; it can be cleared or changed and does not prove a physical device.
- Video playback currently accepts HTTPS video URLs. Cloudflare Stream uploads and signed playback are not integrated yet.
- Paid batches use offline collection requests and administrator verification. The application does not collect money online.
- Neon application persistence and migrations have been configured and verified. SMTP, Cloudflare Stream, Vercel, production backups, and deployment have not been configured or verified.

Keep real credentials in local environment files or a deployment secret manager. Never commit `.env.local`, database files, passwords, or payment/provider credentials.
