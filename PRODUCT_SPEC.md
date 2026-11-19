# EduReels — Product and Technical Specification

## 1. Purpose

EduReels is a responsive online learning platform (LMS) that combines full-length subject classes with short, ordered educational reels. Students can browse learning content, join batches, and resume their progress. Administrators manage the platform and create teacher accounts; teachers publish classes and reels.

This specification is intended to be self-contained so a new developer or team can understand and build the same application without access to the original conversation.

## 2. Product goals

- Provide a usable learning experience on desktop and mobile browsers.
- Let students find and follow educational content by subject and topic.
- Track class and reel progress and resume where the student left off.
- Let administrators manage students, teachers, content, batches, and offline payment verification.
- Start with a practical web application/PWA; keep the backend reusable for a future native mobile client.
- Ship core learning and administration workflows before adding payment-provider integration.

## 3. Users and permissions

### Student

- Register, sign in/out, and change a password while signed in.
- If a student forgets their current password, contact an administrator for a password reset; no email-based recovery is provided.
- Choose and update subjects of interest.
- Browse batches and see whether each is free or paid.
- Join a free batch immediately.
- Request access to a paid batch and follow offline payment instructions.
- View their own enrollment, class progress, reel progress, and profile.
- Access paid content only when the server confirms an active enrollment.

### Teacher

- A teacher account is created and managed by an administrator; public teacher self-registration is not part of the initial release.
- Sign in and manage permitted learning content.
- Create, edit, order, and publish full-length classes and educational reels for assigned subjects/topics.
- Review content and publication state for content they own.
- Do not manage users, payments, enrollments, or administrator settings unless explicitly granted a future permission.

### Administrator

- Use protected administrative screens.
- Create, edit, suspend, and deactivate teacher accounts.
- Manage students and active sessions.
- Create and manage subjects, batches, classes, and reels.
- Assign or change content ownership/subject associations as needed.
- Review offline payment requests, record verification details, and confirm or reject requests.
- View basic enrollment, content, and progress metrics.
- Reset a student's reel progress when necessary; record sensitive administrative actions.
- Manage platform settings and roles.

The first administrator must be provisioned through a documented, secure setup process. Never ship a hard-coded default administrator password.

## 4. Core user journeys

### 4.1 Student onboarding

1. Student registers with full name, email, mobile number, and password.
2. The account is created and the student is signed in without email verification.
3. Student selects one or more subjects; they can change these later.
4. Student lands on a dashboard with relevant subjects, batches, and learning progress.

### 4.2 Free batch

1. Student opens batch details.
2. Student selects **Join**.
3. Server creates one enrollment for that student and batch.
4. The batch and its available content appear in the student's account.

### 4.3 Paid batch — first release (offline collection)

1. Student opens a paid batch and sees the price and administrator-provided offline payment instructions.
2. Student submits a request indicating that they have paid offline and may optionally provide a transaction/reference number.
3. The request remains **pending** and does not unlock paid content.
4. An administrator independently verifies receipt of funds and records the amount, date, method/reference, decision, and verifier.
5. On confirmation, the server creates/activates the enrollment and unlocks the batch. On rejection, access remains locked and the decision is recorded.
6. A student can see the request status and its latest update.

The application does not collect money online in the first release. Do not show a Razorpay checkout, create online charges, or grant access from a client-side claim.

### 4.4 Teacher publishes content

1. Administrator creates a teacher account and assigns permitted subjects.
2. Teacher signs in and creates a class or reel with title, description, subject/topic, video reference, and publication state.
3. Teacher arranges reels within a series using an explicit sequence number.
4. Teacher publishes the content; published content is visible only to students with the appropriate access.
5. Administrators can edit, unpublish, or archive any content.

### 4.5 Reels and learning progress

1. Student opens a subject/topic reel series.
2. Reels are shown in sequence; previously completed reels can be replayed.
3. The application stores each reel's playback position and completion state for that student.
4. A reel is considered complete after the student has watched at least 90% of its duration, subject to server-side validation of playback progress. Merely opening a reel must not count as completion.
5. On return, the student can resume playback and is directed to the next incomplete reel in the current sequence.
6. Reordering or adding reels must not erase existing completion history. Determine the next incomplete reel from the current published sequence.
7. Student progress is private to that student; administrators may inspect or reset it under appropriate authorization.

### 4.6 One active student device session

- Permit one active browser/app-installation session per student account.
- A new login from a different registered installation is blocked until the active session is logged out or invalidated through an authorized recovery flow.
- Re-login from the same registered installation is allowed.
- Enforce the rule server-side. Browser identifiers can be cleared or changed and do not reliably prove physical-device identity; do not claim otherwise.
- Administrators may inspect and revoke active sessions. All revocation actions should be authorized and auditable.

## 5. Functional requirements

### Authentication and account management

- Registration fields: full name, email, mobile number, password, and password confirmation.
- Sign in using email or mobile number and password; provide logout and session persistence.
- Let signed-in users change their password by confirming their current password.
- Administrators can reset a student's password; revoke that student's active sessions and audit the action. Students who forget their password must contact an administrator.
- Do not send email or implement email verification or email-based password recovery.
- Store only securely hashed passwords; use secure session cookies and rate limits for authentication.
- Enforce role checks on the server for every protected operation.

### Subjects and batches

- Administrators can create, edit, publish, and archive subjects and batches.
- Batches have a title, description, subject associations, price, free/paid status, publication state, and content associations.
- Prevent duplicate active enrollment for the same student and batch.
- Students can select multiple subjects and change their selections.
- Show content related to selected subjects while still allowing students to browse other accessible content.

### Classes

- Classes contain a title, description, subject/topic, teacher owner, sequence or grouping metadata as needed, video reference, publication state, and timestamps.
- Students see and play only published classes they are entitled to view.
- Save playback position and completion/progress state so students can continue later.
- Video bytes are hosted by a dedicated video service, not stored in MongoDB.

### Educational reels

- Each reel has a title, description, subject, topic/series, teacher owner, sequence number, video reference, publication state, and timestamps.
- Teachers can manage their own permitted content; administrators can manage all content.
- A sequence number must be unique within its series.
- Students can replay completed content and resume unfinished playback.
- Store per-student, per-reel watch history including playback position, watched duration/progress, completion state, and update/completion times.
- Calculate the next reel from published series order and the student's completion history.
- Validate progress updates server-side; do not trust a bare client-supplied completion flag.

### Offline payment records

- Track payment requests separately from verified payment records.
- Suggested states: `pending`, `confirmed`, and `rejected`.
- Store batch, student, expected amount/currency, submitted reference (optional), decision, verified amount/date/method/reference, verifier, and timestamps as appropriate.
- Protect confirmation/rejection endpoints for administrators only.
- Confirming a payment and activating the enrollment must be consistent and safe to retry; reject duplicate enrollment/payment processing.
- This is a manual record of offline collection, not an online payment integration.

### Administration, notifications, and audit

- Admin screens: overview, students, teachers, active sessions, subjects, batches, classes, reels, pending payments, and basic analytics.
- Basic analytics can include counts of students, active students, batches, published classes/reels, enrollments, reel views/completions, and verified offline collections.
- Show relevant enrollment/payment status updates as in-app notifications only; do not send email or push notifications.
- Record important actions such as account/role changes, payment decisions, progress resets, and content publication changes.

## 6. Page map

### Public and student routes

| Page | Suggested route |
|---|---|
| Home | `/` |
| Register | `/register` |
| Login | `/login` |
| Account security | `/account` |
| Forgotten password help | `/forgot-password` |
| Student dashboard | `/dashboard` |
| Browse batches | `/batches` |
| Batch details | `/batches/[id]` |
| My batches | `/my-batches` |
| Subjects | `/subjects` |
| Subject/topic reels | `/reels/[seriesId]` |
| Reel player | `/reel/[id]` |
| Classes | `/classes` |
| Class player | `/classes/[id]` |
| My progress | `/progress` |
| Profile | `/profile` |

### Teacher routes

| Page | Suggested route |
|---|---|
| Teacher dashboard | `/teacher` |
| Teacher classes | `/teacher/classes` |
| Create/edit class | `/teacher/classes/[id]` |
| Teacher reels and series | `/teacher/reels` |
| Create/edit reel | `/teacher/reels/[id]` |

### Administrator routes

| Page | Suggested route |
|---|---|
| Admin dashboard | `/admin` |
| Students and sessions | `/admin/students`, `/admin/sessions` |
| Teacher accounts | `/admin/teachers` |
| Subjects and batches | `/admin/subjects`, `/admin/batches` |
| Classes and reels | `/admin/classes`, `/admin/reels` |
| Offline payments | `/admin/payments` |
| Analytics and audit | `/admin/analytics`, `/admin/audit-logs` |
| Settings | `/admin/settings` |

Routes are illustrative. The implementation may group screens differently while preserving role boundaries and journeys.

## 7. Data model outline

Use MongoDB Atlas collections with unique and supporting indexes. Store relationships as validated numeric IDs and use Atlas transactions for multi-document operations that must commit together.

| Entity/table | Purpose |
|---|---|
| `users` | Student, teacher, and administrator identities and role/status |
| `sessions` | Authenticated sessions |
| `active_device_sessions` | Student's registered active installation/session |
| `subjects` | Subject catalog |
| `student_subjects` | Student subject selections |
| `batches` | Free/paid learning groups |
| `batch_subjects` | Batch-to-subject associations |
| `enrollments` | Student access to a batch |
| `offline_payment_requests` | Student-submitted offline payment claims and decisions |
| `classes` | Full-length class metadata and video references |
| `class_progress` | Student class position/progress |
| `reel_series` | Ordered group of reels for a subject/topic |
| `reels` | Reel metadata, publication state, and series position |
| `reel_watch_history` | Per-student reel position and completion history |
| `notifications` | In-app notifications |
| `audit_logs` | Important administrative and security events |

Use unique indexes for student enrollment per batch, student/reel progress, and reel sequence within a series. A payment confirmation and its enrollment change must be handled transactionally or with an equivalent safe, retryable process. Preserve numeric IDs and relationships when importing existing PostgreSQL records.

## 8. Suggested architecture and technology

The initial proposal is:

| Concern | Initial choice |
|---|---|
| Web application | Next.js, TypeScript |
| UI | Tailwind CSS and accessible reusable components |
| Server | Next.js server actions/API routes with server-side authorization |
| Database | MongoDB Atlas |
| Data access/migrations | MongoDB Node.js driver, indexed collections, and an idempotent PostgreSQL-to-Atlas importer |
| Authentication | Better Auth, subject to validating role and session requirements |
| Password hashing | Use the authentication library's supported secure password hashing; never store plaintext |
| Video | Cloudflare Stream or another selected streaming host |
| PWA | Installable responsive web app |
| Hosting | Vercel or an equivalent documented provider |
| Version control/development | GitHub and GitHub Codespaces |

Keep the stack in one web application for the initial release. Store video references and metadata in the database, not video files. Use environment variables for service credentials.

## 9. Release plan

### Release 1 — Core platform with offline collections

- Responsive web application/PWA foundation.
- Student registration, login, password changes, administrator-assisted recovery, and role-protected sessions.
- Administrator-created teacher accounts.
- Subject and batch management; free enrollment.
- Paid batch request and administrator verification of offline payment.
- Teacher class/reel authoring and publishing.
- Student class playback, sequential reels, and saved/resumable progress.
- Basic administration, student/teacher management, and activity records.
- No Razorpay checkout or automated online payments.

### Release 2 — Operations and engagement

- More complete notifications and analytics.
- Additional administrative reporting and quality-of-life improvements.
- Refined mobile/PWA experience and operational monitoring.
- Video access and performance improvements based on the selected provider.

### Release 3 — Online payment

- Add Razorpay only after the offline workflow is working and the business account and credentials are available.
- Create payment orders on the server, verify provider signatures/status on the server, and process provider webhooks safely and idempotently.
- Grant enrollment only after verified payment; support reconciliation, failures, cancellations, and refunds.
- Keep manual offline records distinguishable from provider transactions.

### Future possibility — Native mobile apps

A React Native or other native client may be built later against the same backend. It is not a prerequisite for the first release.

## 10. Acceptance criteria

The first release is not complete until all of the following hold:

1. A student can register and sign in without email, change their password using their current password, ask an administrator for a reset if necessary, and sign out.
2. Student, teacher, and administrator permissions are enforced server-side.
3. An administrator can create a teacher; that teacher can publish an assigned-subject class and reel.
4. A student can choose subjects and browse relevant published content.
5. A student can join a free batch and access its content.
6. A paid-batch request remains locked while pending; only an authorized administrator's recorded confirmation unlocks it.
7. The student can resume a class and reel after leaving and returning.
8. Reel completion requires the defined watch threshold; opening a reel or sending a bare completion flag is insufficient.
9. The next incomplete reel is determined by the current series order without losing existing history.
10. A student cannot access another student's private progress or content they are not entitled to view.
11. The application works at common mobile and desktop viewport sizes.
12. Setup instructions, migrations, tests, and required environment variables are documented.

## 11. Security, privacy, and operational requirements

- Hash passwords and protect sessions with secure cookie settings appropriate to the deployment.
- Apply server-side authorization to every protected page and mutation.
- Keep database, video, and future payment credentials in environment variables/secrets management.
- Rate-limit login and password changes; require the current password for self-service changes and audit administrator resets.
- Validate and authorize upload operations and never expose provider secrets to the browser.
- Restrict video playback to entitled users using provider access controls/signed playback where available.
- Validate progress and payment state transitions on the server.
- Maintain backups and document restore procedures before production launch.
- Minimize personal data and define retention/access policies before launch.
- Signed playback links can reduce unauthorized access but cannot prevent screen recording.
- A browser/app installation identifier can enforce a practical session limit, not prove physical device identity.

## 12. External services and launch dependencies

The platform can be developed with local configuration, but launch requires selecting and configuring relevant services:

- MongoDB Atlas project, database user, authorized network access, and connection string. Importing existing PostgreSQL records additionally requires a read-accessible source connection string.
- Video hosting/streaming provider and credentials.
- Hosting provider, domain, and production environment configuration.
- Offline payment instructions and a documented administrator verification process.
- Razorpay business account and credentials only for the later online-payment release.

Do not commit credentials. Document required variable names and safe setup steps in the application repository when those integrations are implemented.
