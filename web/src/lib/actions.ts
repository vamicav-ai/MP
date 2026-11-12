"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { clearSession, getCurrentUser, requireUser, startSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { calculateReelProgress } from "@/lib/reel-progress";

function message(path: string, value: string, key = "notice"): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

function positiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function audit(actorId: number, action: string, details: string): Promise<void> {
  await getDb().prepare("INSERT INTO audit_logs (actor_id, action, details) VALUES (?, ?, ?)").run(actorId, action, details);
}

async function hasBatchAccess(studentId: number, batchId: number | null): Promise<boolean> {
  if (batchId === null) return true;
  return Boolean(
    await getDb()
      .prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = ? AND status = 'active'")
      .get(studentId, batchId),
  );
}

async function teacherOwnsSubject(userId: number, role: string, subjectId: number): Promise<boolean> {
  return role === "admin" || Boolean(
    await getDb().prepare("SELECT 1 FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ?").get(userId, subjectId),
  );
}

export async function provisionFirstAdmin(data: FormData): Promise<void> {
  const db = getDb();
  const hasUsers = Number((await db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count) > 0;
  if (hasUsers) message("/setup", "Initial setup has already been completed.", "error");

  const name = text(data, "name");
  const email = text(data, "email").toLowerCase();
  const mobile = text(data, "mobile");
  const password = text(data, "password");
  if (!name || !email.includes("@") || !mobile || password.length < 12) {
    message("/setup", "Enter your name, a valid email, mobile number, and a password of at least 12 characters.", "error");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let adminId: number;
  try {
    adminId = await db.transaction(async (tx) => {
      if (Number((await tx.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count) > 0) {
        throw new Error("Initial setup has already been completed.");
      }
      const result = await tx.prepare("INSERT INTO users (name, email, mobile, password_hash, email_verified, role) VALUES (?, ?, ?, ?, 1, 'admin') RETURNING id")
        .get(name, email, mobile, passwordHash) as { id: number };
      return result.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      message("/setup", "That email is already in use.", "error");
    }
    throw error;
  }
  await startSession(adminId, "admin");
  await audit(adminId, "admin.bootstrap", email);
  message("/dashboard", "Administrator account created.");
}

export async function registerStudent(data: FormData): Promise<void> {
  const name = text(data, "name");
  const email = text(data, "email").toLowerCase();
  const mobile = text(data, "mobile");
  const password = text(data, "password");
  const confirmation = text(data, "confirmPassword");
  if (!name || !email.includes("@") || !mobile || password.length < 10 || password !== confirmation) {
    message("/register", "Enter valid details, use a password of at least 10 characters, and confirm it.", "error");
  }

  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  let userId: number;
  try {
    userId = await db.transaction(async (tx) => {
      const result = await tx
        .prepare("INSERT INTO users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, 'student') RETURNING id")
        .get(name, email, mobile, await bcrypt.hash(password, 12)) as { id: number };
      await tx.prepare("INSERT INTO verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
        .run(result.id, hashToken(token), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      return result.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      message("/register", "An account with that email already exists.", "error");
    }
    throw error;
  }
  try {
    await sendVerificationEmail(email, name, token);
  } catch (error) {
    await db.prepare("DELETE FROM users WHERE id = ? AND email_verified = 0").run(userId);
    if (error instanceof Error && error.message.startsWith("SMTP_")) {
      message("/register", "Email delivery is not configured. Contact the platform administrator before registering.", "error");
    }
    throw error;
  }
  message("/login", "Check your email for a verification link before signing in.");
}

export async function signIn(data: FormData): Promise<void> {
  const identifier = text(data, "identifier").toLowerCase();
  const password = text(data, "password");
  const user = await getDb()
    .prepare("SELECT id, password_hash, role, active, email_verified FROM users WHERE lower(email) = ? OR mobile = ?")
    .get(identifier, identifier) as { id: number; password_hash: string; role: "student" | "teacher" | "admin"; active: number; email_verified: number } | undefined;

  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    message("/login", "Email/mobile or password is incorrect.", "error");
  }
  if (!user.email_verified) message("/login", "Verify your email address before signing in.", "error");

  try {
    await startSession(user.id, user.role);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already active on another browser")) {
      message("/login", error.message, "error");
    }
    throw error;
  }
  message("/dashboard", "Welcome back.");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function verifyEmail(data: FormData): Promise<void> {
  const token = text(data, "token");
  if (token.length < 20 || token.length > 200) message("/verify-email", "This verification link is invalid or expired.", "error");

  const db = getDb();
  const userId = await db.transaction(async (tx) => {
    const verification = await tx.prepare(`
      SELECT id, user_id FROM verification_tokens
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > now()
    `).get(hashToken(token)) as { id: number; user_id: number } | undefined;
    if (!verification) return null;

    const consumed = await tx.prepare(`
      UPDATE verification_tokens SET consumed_at = now()
      WHERE id = ? AND consumed_at IS NULL AND expires_at > now()
      RETURNING user_id
    `).get(verification.id) as { user_id: number } | undefined;
    if (!consumed) return null;
    await tx.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(consumed.user_id);
    return consumed.user_id;
  });
  if (!userId) message("/verify-email", "This verification link is invalid or expired.", "error");
  message("/login", "Your email is verified. You can now sign in.");
}

export async function requestPasswordReset(data: FormData): Promise<void> {
  const email = text(data, "email").toLowerCase();
  if (!email.includes("@")) message("/forgot-password", "Enter a valid email address.", "error");

  const db = getDb();
  const user = await db.prepare("SELECT id, name FROM users WHERE lower(email) = ? AND active = 1")
    .get(email) as { id: number; name: string } | undefined;
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND consumed_at IS NULL").run(user.id);
      await tx.prepare("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
        .run(user.id, tokenHash, new Date(Date.now() + 60 * 60 * 1000).toISOString());
    });
    try {
      await sendPasswordResetEmail(email, user.name, token);
    } catch (error) {
      await db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash);
      if (error instanceof Error && error.message.startsWith("SMTP_")) {
        message("/forgot-password", "Email delivery is not configured. Contact the platform administrator for help.", "error");
      }
      throw error;
    }
  }
  message("/forgot-password", "If an active account uses that email, password reset instructions have been sent.");
}

export async function resetPassword(data: FormData): Promise<void> {
  const token = text(data, "token");
  const password = text(data, "password");
  const confirmation = text(data, "confirmPassword");
  if (token.length < 20 || token.length > 200 || password.length < 10 || password !== confirmation) {
    message(`/reset-password?token=${encodeURIComponent(token)}`, "Use a valid link, a password of at least 10 characters, and matching confirmation.", "error");
  }

  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = await db.transaction(async (tx) => {
    const reset = await tx.prepare(`
      SELECT id, user_id FROM password_reset_tokens
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > now()
    `).get(hashToken(token)) as { id: number; user_id: number } | undefined;
    if (!reset) return null;
    const consumed = await tx.prepare(`
      UPDATE password_reset_tokens SET consumed_at = now()
      WHERE id = ? AND consumed_at IS NULL AND expires_at > now()
      RETURNING user_id
    `).get(reset.id) as { user_id: number } | undefined;
    if (!consumed) return null;
    await tx.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, consumed.user_id);
    await tx.prepare("DELETE FROM sessions WHERE user_id = ?").run(consumed.user_id);
    return consumed.user_id;
  });
  if (!userId) message("/forgot-password", "This password reset link is invalid or expired. Request a new one.");
  message("/login", "Your password has been reset. Sign in with your new password.");
}

export async function chooseSubjects(data: FormData): Promise<void> {
  const user = await requireUser(["student"]);
  const ids = [...new Set(data.getAll("subjectIds").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM student_subjects WHERE student_id = ?").run(user.id);
    const insert = tx.prepare("INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)");
    for (const id of ids) {
      if (!await tx.prepare("SELECT 1 FROM subjects WHERE id = ? AND active = 1").get(id)) {
        throw new Error("A selected subject is unavailable.");
      }
      await insert.run(user.id, id);
    }
  });
  message("/dashboard", "Your subject preferences are saved.");
}

export async function joinFreeBatch(data: FormData): Promise<void> {
  const user = await requireUser(["student"]);
  const batchId = positiveInt(text(data, "batchId"));
  if (!batchId) message("/batches", "Invalid batch.", "error");
  const db = getDb();
  const batch = await db.prepare("SELECT is_free, published FROM batches WHERE id = ?").get(batchId) as { is_free: number; published: number } | undefined;
  if (!batch?.published || !batch.is_free) message("/batches", "This batch is not available for free enrollment.", "error");

  await db.prepare(`
    INSERT INTO enrollments (student_id, batch_id) VALUES (?, ?)
    ON CONFLICT(student_id, batch_id) DO UPDATE SET status = 'active'
  `).run(user.id, batchId);
  await audit(user.id, "enrollment.free", String(batchId));
  message("/batches", "You have joined the batch.");
}

export async function requestOfflinePayment(data: FormData): Promise<void> {
  const user = await requireUser(["student"]);
  const batchId = positiveInt(text(data, "batchId"));
  const reference = text(data, "reference").slice(0, 120);
  if (!batchId) message("/batches", "Invalid batch.", "error");

  const db = getDb();
  const batch = await db
    .prepare("SELECT price_paise, is_free, published FROM batches WHERE id = ?")
    .get(batchId) as { price_paise: number; is_free: number; published: number } | undefined;
  if (!batch?.published || batch.is_free) message("/batches", "This batch is not available for offline payment.", "error");
  if (await db.prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = ? AND status = 'active'").get(user.id, batchId)) {
    message("/batches", "You are already enrolled in this batch.");
  }

  await db.prepare(`
    INSERT INTO offline_payment_requests (student_id, batch_id, amount_paise, reference)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id, batch_id) DO UPDATE SET
      amount_paise = excluded.amount_paise,
      reference = excluded.reference,
      status = 'pending',
      decision_note = '',
      verified_by = NULL,
      verified_at = NULL
    WHERE offline_payment_requests.status IN ('pending', 'rejected')
  `).run(user.id, batchId, batch.price_paise, reference);
  await audit(user.id, "payment.offline.requested", String(batchId));
  message("/batches", "Offline payment request submitted. Access stays locked until an administrator confirms receipt.");
}

export async function decideOfflinePayment(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const requestId = positiveInt(text(data, "requestId"));
  const decision = text(data, "decision");
  const note = text(data, "decisionNote").slice(0, 500);
  const paymentMethod = text(data, "paymentMethod").slice(0, 80);
  const verifiedRupees = Number(text(data, "verifiedAmount"));
  if (!requestId || !["confirmed", "rejected"].includes(decision)) {
    message("/admin/payments", "Invalid payment decision.", "error");
  }
  if (decision === "confirmed" && (!Number.isFinite(verifiedRupees) || verifiedRupees <= 0 || !paymentMethod)) {
    message("/admin/payments", "Enter the verified amount and collection method before confirming.", "error");
  }

  const db = getDb();
  const request = await db
    .prepare("SELECT id, student_id, batch_id, status FROM offline_payment_requests WHERE id = ?")
    .get(requestId) as { id: number; student_id: number; batch_id: number; status: string } | undefined;
  if (!request || request.status !== "pending") message("/admin/payments", "This request is no longer pending.", "error");

  await db.transaction(async (tx) => {
    const updated = await tx.prepare(`
      UPDATE offline_payment_requests SET status = ?, decision_note = ?, verified_by = ?, verified_at = ?,
        verified_amount_paise = ?, payment_method = ?
      WHERE id = ? AND status = 'pending'
    `).run(
      decision,
      note,
      admin.id,
      new Date().toISOString(),
      decision === "confirmed" ? Math.round(verifiedRupees * 100) : null,
      decision === "confirmed" ? paymentMethod : null,
      requestId,
    );
    if (updated.changes !== 1) throw new Error("This payment request has already been processed.");
    if (decision === "confirmed") {
      await tx.prepare(`
        INSERT INTO enrollments (student_id, batch_id) VALUES (?, ?)
        ON CONFLICT(student_id, batch_id) DO UPDATE SET status = 'active'
      `).run(request.student_id, request.batch_id);
      await tx.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)").run(
        request.student_id,
        "Your offline payment has been verified and your batch is now available.",
      );
    } else {
      await tx.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)").run(
        request.student_id,
        "Your offline payment request was not confirmed. Contact the administrator for details.",
      );
    }
    await tx.prepare("INSERT INTO audit_logs (actor_id, action, details) VALUES (?, ?, ?)")
      .run(admin.id, `payment.offline.${decision}`, String(requestId));
  });
  message("/admin/payments", `Payment request ${decision}.`);
}

export async function createTeacher(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const name = text(data, "name");
  const email = text(data, "email").toLowerCase();
  const mobile = text(data, "mobile");
  const password = text(data, "password");
  const subjectIds = [...new Set(data.getAll("subjectIds").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!name || !email.includes("@") || !mobile || password.length < 12 || subjectIds.length === 0) {
    message("/admin/teachers", "Provide valid account details, a 12-character temporary password, and at least one subject.", "error");
  }

  const db = getDb();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.transaction(async (tx) => {
      const result = await tx.prepare("INSERT INTO users (name, email, mobile, password_hash, email_verified, role) VALUES (?, ?, ?, ?, 1, 'teacher') RETURNING id")
        .get(name, email, mobile, passwordHash) as { id: number };
      const insert = tx.prepare("INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)");
      for (const id of subjectIds) {
        if (!await tx.prepare("SELECT 1 FROM subjects WHERE id = ? AND active = 1").get(id)) {
          throw new Error("A selected subject is unavailable.");
        }
        await insert.run(result.id, id);
      }
      await tx.prepare("INSERT INTO audit_logs (actor_id, action, details) VALUES (?, 'teacher.created', ?)")
        .run(admin.id, email);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      message("/admin/teachers", "An account with that email already exists.", "error");
    }
    throw error;
  }
  message("/admin/teachers", "Teacher account created. Share the temporary password securely.");
}

export async function toggleTeacher(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const teacherId = positiveInt(text(data, "teacherId"));
  if (!teacherId) message("/admin/teachers", "Invalid teacher.", "error");
  const teacher = await getDb().prepare("SELECT id, active FROM users WHERE id = ? AND role = 'teacher'").get(teacherId) as { id: number; active: number } | undefined;
  if (!teacher) message("/admin/teachers", "Teacher not found.", "error");
  await getDb().prepare("UPDATE users SET active = ? WHERE id = ?").run(teacher.active ? 0 : 1, teacherId);
  await audit(admin.id, teacher.active ? "teacher.suspended" : "teacher.activated", String(teacherId));
  message("/admin/teachers", teacher.active ? "Teacher suspended." : "Teacher activated.");
}

export async function createSubject(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const name = text(data, "name");
  const description = text(data, "description").slice(0, 500);
  if (name.length < 2) message("/admin/subjects", "Subject name must be at least 2 characters.", "error");
  try {
    await getDb().prepare("INSERT INTO subjects (name, description) VALUES (?, ?)").run(name, description);
  } catch (error) {
    if (isUniqueViolation(error)) {
      message("/admin/subjects", "That subject already exists.", "error");
    }
    throw error;
  }
  await audit(admin.id, "subject.created", name);
  message("/admin/subjects", "Subject created.");
}

export async function createBatch(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const title = text(data, "title");
  const description = text(data, "description").slice(0, 1000);
  const price = Number(text(data, "price"));
  const subjectIds = [...new Set(data.getAll("subjectIds").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (title.length < 3 || !Number.isFinite(price) || price < 0 || subjectIds.length === 0) {
    message("/admin/batches", "Enter a batch title, a non-negative price, and at least one subject.", "error");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const result = await tx.prepare("INSERT INTO batches (title, description, price_paise, is_free) VALUES (?, ?, ?, ?) RETURNING id")
      .get(title, description, Math.round(price * 100), price === 0 ? 1 : 0) as { id: number };
    const insert = tx.prepare("INSERT INTO batch_subjects (batch_id, subject_id) VALUES (?, ?)");
    for (const id of subjectIds) {
      if (!await tx.prepare("SELECT 1 FROM subjects WHERE id = ? AND active = 1").get(id)) {
        throw new Error("A selected subject is unavailable.");
      }
      await insert.run(result.id, id);
    }
  });
  await audit(admin.id, "batch.created", title);
  message("/admin/batches", "Batch created.");
}

export async function toggleBatch(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const batchId = positiveInt(text(data, "batchId"));
  if (!batchId) message("/admin/batches", "Invalid batch.", "error");
  const batch = await getDb().prepare("SELECT published FROM batches WHERE id = ?").get(batchId) as { published: number } | undefined;
  if (!batch) message("/admin/batches", "Batch not found.", "error");
  await getDb().prepare("UPDATE batches SET published = ? WHERE id = ?").run(batch.published ? 0 : 1, batchId);
  await audit(admin.id, batch.published ? "batch.archived" : "batch.published", String(batchId));
  message("/admin/batches", batch.published ? "Batch unpublished." : "Batch published.");
}

export async function createClass(data: FormData): Promise<void> {
  const user = await requireUser(["teacher", "admin"]);
  const title = text(data, "title");
  const description = text(data, "description").slice(0, 1500);
  const subjectId = positiveInt(text(data, "subjectId"));
  const batchId = positiveInt(text(data, "batchId"));
  const videoUrl = text(data, "videoUrl");
  const duration = Number(text(data, "durationSeconds"));
  const published = user.role === "admin" || text(data, "published") === "on" ? 1 : 0;
  if (
    title.length < 3 ||
    !subjectId ||
    !videoUrl.startsWith("https://") ||
    !Number.isSafeInteger(duration) ||
    duration < 0 ||
    !await teacherOwnsSubject(user.id, user.role, subjectId)
  ) {
    message("/teacher/content", "Enter valid class details and use an assigned subject and HTTPS video URL.", "error");
  }
  await getDb().prepare(`
    INSERT INTO classes (title, description, subject_id, teacher_id, batch_id, video_url, duration_seconds, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, subjectId, user.id, batchId, videoUrl, duration, published);
  await audit(user.id, "class.created", title);
  message("/teacher/content", "Class created.");
}

export async function createReelSeries(data: FormData): Promise<void> {
  const user = await requireUser(["teacher", "admin"]);
  const title = text(data, "title");
  const topic = text(data, "topic").slice(0, 120);
  const subjectId = positiveInt(text(data, "subjectId"));
  const batchId = positiveInt(text(data, "batchId"));
  if (title.length < 3 || !subjectId || !await teacherOwnsSubject(user.id, user.role, subjectId)) {
    message("/teacher/content", "Enter a series title and a subject assigned to your account.", "error");
  }
  const result = await getDb().prepare(`
    INSERT INTO reel_series (title, topic, subject_id, teacher_id, batch_id, published)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(title, topic, subjectId, user.id, batchId, user.role === "admin" ? 1 : 0) as { id: number };
  await audit(user.id, "reel_series.created", title);
  message("/teacher/content", `Series created (ID ${result.id}). Add reels below.`);
}

export async function createReel(data: FormData): Promise<void> {
  const user = await requireUser(["teacher", "admin"]);
  const seriesId = positiveInt(text(data, "seriesId"));
  const title = text(data, "title");
  const description = text(data, "description").slice(0, 1000);
  const videoUrl = text(data, "videoUrl");
  const duration = Number(text(data, "durationSeconds"));
  const sequence = Number(text(data, "sequenceNumber"));
  if (!seriesId || title.length < 3 || !videoUrl.startsWith("https://") || !Number.isSafeInteger(duration) || duration <= 0 || !Number.isSafeInteger(sequence) || sequence <= 0) {
    message("/teacher/content", "Enter a series, title, HTTPS video URL, positive duration, and sequence number.", "error");
  }
  const series = await getDb().prepare("SELECT teacher_id, subject_id FROM reel_series WHERE id = ?").get(seriesId) as { teacher_id: number; subject_id: number } | undefined;
  if (!series || (user.role === "teacher" && (series.teacher_id !== user.id || !await teacherOwnsSubject(user.id, user.role, series.subject_id)))) {
    message("/teacher/content", "You do not have permission to edit this series.", "error");
  }
  try {
    await getDb().prepare(`
      INSERT INTO reels (series_id, title, description, video_url, duration_seconds, sequence_number, published)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(seriesId, title, description, videoUrl, duration, sequence, user.role === "admin" ? 1 : 0);
  } catch (error) {
    if (isUniqueViolation(error)) {
      message("/teacher/content", "That sequence number is already used in this series.", "error");
    }
    throw error;
  }
  await audit(user.id, "reel.created", title);
  message("/teacher/content", "Reel created.");
}

export async function togglePublication(data: FormData): Promise<void> {
  const user = await requireUser(["teacher", "admin"]);
  const entity = text(data, "entity");
  const id = positiveInt(text(data, "id"));
  if (!id || !["class", "series", "reel"].includes(entity)) {
    message(user.role === "admin" ? "/admin/content" : "/teacher/content", "Invalid content.", "error");
  }
  const db = getDb();
  let current: { published: number; teacher_id?: number } | undefined;
  if (entity === "class") current = await db.prepare("SELECT published, teacher_id FROM classes WHERE id = ?").get(id) as typeof current;
  if (entity === "series") current = await db.prepare("SELECT published, teacher_id FROM reel_series WHERE id = ?").get(id) as typeof current;
  if (entity === "reel") {
    current = await db.prepare(`
      SELECT reels.published, reel_series.teacher_id FROM reels
      JOIN reel_series ON reel_series.id = reels.series_id WHERE reels.id = ?
    `).get(id) as typeof current;
  }
  if (!current || (user.role === "teacher" && current.teacher_id !== user.id)) {
    message(user.role === "admin" ? "/admin/content" : "/teacher/content", "Content not found or access denied.", "error");
  }
  const table = entity === "class" ? "classes" : entity === "series" ? "reel_series" : "reels";
  await db.prepare(`UPDATE ${table} SET published = ? WHERE id = ?`).run(current.published ? 0 : 1, id);
  await audit(user.id, `${entity}.${current.published ? "unpublished" : "published"}`, String(id));
  message(user.role === "admin" ? "/admin/content" : "/teacher/content", current.published ? "Content unpublished." : "Content published.");
}

export async function saveClassProgress(classId: number, positionSeconds: number): Promise<void> {
  const student = await requireUser(["student"]);
  if (!Number.isSafeInteger(classId) || classId <= 0 || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    throw new Error("Invalid class progress update.");
  }
  const db = getDb();
  const item = await db.prepare("SELECT batch_id, duration_seconds, published FROM classes WHERE id = ?")
    .get(classId) as { batch_id: number | null; duration_seconds: number; published: number } | undefined;
  if (!item?.published || !await hasBatchAccess(student.id, item.batch_id)) {
    throw new Error("This class is not available to your account.");
  }
  const position = Math.min(Math.floor(positionSeconds), item.duration_seconds || Math.floor(positionSeconds));
  await db.prepare(`
    INSERT INTO class_progress (student_id, class_id, position_seconds) VALUES (?, ?, ?)
    ON CONFLICT(student_id, class_id) DO UPDATE SET
      position_seconds = excluded.position_seconds,
      updated_at = datetime('now')
  `).run(student.id, classId, position);
}

export async function beginReel(reelId: number, positionSeconds: number): Promise<void> {
  const student = await requireUser(["student"]);
  if (!Number.isSafeInteger(reelId) || reelId <= 0 || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    throw new Error("Invalid reel progress update.");
  }
  const db = getDb();
  const reel = await db.prepare(`
    SELECT reels.duration_seconds, reel_series.batch_id, reels.published, reel_series.published AS series_published
    FROM reels JOIN reel_series ON reel_series.id = reels.series_id WHERE reels.id = ?
  `).get(reelId) as { duration_seconds: number; batch_id: number | null; published: number; series_published: number } | undefined;
  if (!reel?.published || !reel.series_published || !await hasBatchAccess(student.id, reel.batch_id)) {
    throw new Error("This reel is not available to your account.");
  }

  const progress = await db.prepare("SELECT position_seconds, completed FROM reel_progress WHERE student_id = ? AND reel_id = ?")
    .get(student.id, reelId) as { position_seconds: number; completed: number } | undefined;
  const position = Math.min(Math.max(0, Math.floor(positionSeconds || 0)), reel.duration_seconds);
  await db.prepare(`
    INSERT INTO reel_progress (student_id, reel_id, position_seconds, checkpoint_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id, reel_id) DO UPDATE SET checkpoint_at = excluded.checkpoint_at
  `).run(student.id, reelId, progress?.position_seconds ?? position, new Date().toISOString());
}

export async function saveReelProgress(reelId: number, positionSeconds: number): Promise<void> {
  const student = await requireUser(["student"]);
  if (!Number.isSafeInteger(reelId) || reelId <= 0 || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    throw new Error("Invalid reel progress update.");
  }
  const db = getDb();
  const reel = await db.prepare(`
    SELECT reels.duration_seconds, reel_series.batch_id, reels.published, reel_series.published AS series_published
    FROM reels JOIN reel_series ON reel_series.id = reels.series_id WHERE reels.id = ?
  `).get(reelId) as { duration_seconds: number; batch_id: number | null; published: number; series_published: number } | undefined;
  if (!reel?.published || !reel.series_published || !await hasBatchAccess(student.id, reel.batch_id)) {
    throw new Error("This reel is not available to your account.");
  }

  const existing = await db.prepare(`
    SELECT position_seconds, watched_seconds, checkpoint_at, completed
    FROM reel_progress WHERE student_id = ? AND reel_id = ?
  `).get(student.id, reelId) as {
    position_seconds: number;
    watched_seconds: number;
    checkpoint_at: string;
    completed: number;
  } | undefined;
  const progress = calculateReelProgress(existing, positionSeconds, reel.duration_seconds, new Date());
  if (!existing) {
    await db.prepare(`
      INSERT INTO reel_progress (student_id, reel_id, position_seconds, watched_seconds, completed, checkpoint_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      student.id,
      reelId,
      progress.position_seconds,
      progress.watched_seconds,
      progress.completed,
      progress.checkpoint_at,
    );
    return;
  }
  await db.prepare(`
    UPDATE reel_progress SET position_seconds = ?, watched_seconds = ?, completed = ?,
      checkpoint_at = ?, updated_at = datetime('now')
    WHERE student_id = ? AND reel_id = ?
  `).run(
    progress.position_seconds,
    progress.watched_seconds,
    progress.completed,
    progress.checkpoint_at,
    student.id,
    reelId,
  );
}

export async function resetStudentProgress(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const studentId = positiveInt(text(data, "studentId"));
  if (!studentId) message("/admin/students", "Invalid student.", "error");
  const db = getDb();
  await db.prepare("DELETE FROM reel_progress WHERE student_id = ?").run(studentId);
  await db.prepare("DELETE FROM class_progress WHERE student_id = ?").run(studentId);
  await audit(admin.id, "student.progress.reset", String(studentId));
  message("/admin/students", "Student learning progress reset.");
}

export async function markNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await getDb().prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(user.id);
}
