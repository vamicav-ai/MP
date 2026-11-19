"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { clearSession, getCurrentUser, requireUser, startSession } from "@/lib/auth";
import { getDb, initializeDatabase, nextId, withTransaction } from "@/lib/db";
import type {
  AuditLogDocument,
  BatchDocument,
  ClassDocument,
  ClassProgressDocument,
  EnrollmentDocument,
  NotificationDocument,
  OfflinePaymentDocument,
  ReelDocument,
  ReelProgressDocument,
  ReelSeriesDocument,
  SessionDocument,
  SubjectDocument,
  UserDocument,
} from "@/lib/models";
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

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function audit(actorId: number, action: string, details: string): Promise<void> {
  await initializeDatabase();
  await getDb().collection<AuditLogDocument>("audit_logs").insertOne({
    id: await nextId("audit_logs"),
    actor_id: actorId,
    action,
    details,
    created_at: new Date(),
  });
}

async function hasBatchAccess(studentId: number, batchId: number | null): Promise<boolean> {
  if (batchId === null) return true;
  await initializeDatabase();
  return Boolean(await getDb().collection<EnrollmentDocument>("enrollments")
    .findOne({ student_id: studentId, batch_id: batchId, status: "active" }));
}

async function teacherOwnsSubject(userId: number, role: string, subjectId: number): Promise<boolean> {
  if (role === "admin") return true;
  await initializeDatabase();
  return Boolean(await getDb().collection("teacher_subjects").findOne({
    teacher_id: userId,
    subject_id: subjectId,
  }));
}

async function activateEnrollment(studentId: number, batchId: number, session?: import("mongodb").ClientSession): Promise<void> {
  const database = getDb();
  const enrollments = database.collection<EnrollmentDocument>("enrollments");
  const id = await nextId("enrollments", session);
  try {
    await enrollments.updateOne(
      { student_id: studentId, batch_id: batchId },
      {
        $set: { status: "active" },
        $setOnInsert: { id, created_at: new Date() },
      },
      { upsert: true, session },
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await enrollments.updateOne(
      { student_id: studentId, batch_id: batchId },
      { $set: { status: "active" } },
      { session },
    );
  }
}

export async function provisionFirstAdmin(data: FormData): Promise<void> {
  await initializeDatabase();
  const database = getDb();
  const users = database.collection<UserDocument>("users");
  if (await users.countDocuments() > 0) message("/setup", "Initial setup has already been completed.", "error");

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
    adminId = await withTransaction(async (session) => {
      if (await users.countDocuments({}, { session }) > 0) throw new Error("Initial setup has already been completed.");
      const id = await nextId("users", session);
      await users.insertOne({
        id,
        name,
        email,
        email_key: email,
        mobile,
        password_hash: passwordHash,
        role: "admin",
        active: 1,
        created_at: new Date(),
      }, { session });
      await database.collection<{ _id: string; user_id: number }>("settings")
        .insertOne({ _id: "first-admin", user_id: id }, { session });
      return id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await users.findOne({ email_key: email });
      if (existing) message("/setup", "That email is already in use.", "error");
      message("/setup", "Initial setup has already been completed.", "error");
    }
    if (error instanceof Error && error.message === "Initial setup has already been completed.") {
      message("/setup", error.message, "error");
    }
    throw error;
  }
  await startSession(adminId, "admin");
  await audit(adminId, "admin.bootstrap", email);
  message("/dashboard", "Administrator account created.");
}

export async function registerStudent(data: FormData): Promise<void> {
  await initializeDatabase();
  const name = text(data, "name");
  const email = text(data, "email").toLowerCase();
  const mobile = text(data, "mobile");
  const password = text(data, "password");
  const confirmation = text(data, "confirmPassword");
  if (!name || !email.includes("@") || !mobile || password.length < 10 || password !== confirmation) {
    message("/register", "Enter valid details, use a password of at least 10 characters, and confirm it.", "error");
  }

  const database = getDb();
  let userId: number;
  try {
    userId = await withTransaction(async (session) => {
      const id = await nextId("users", session);
      await database.collection<UserDocument>("users").insertOne({
        id,
        name,
        email,
        email_key: email,
        mobile,
        password_hash: await bcrypt.hash(password, 12),
        role: "student",
        active: 1,
        created_at: new Date(),
      }, { session });
      return id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) message("/register", "An account with that email already exists.", "error");
    throw error;
  }
  await startSession(userId, "student");
  message("/dashboard", "Your account is ready. Welcome to EduReels.");
}

export async function signIn(data: FormData): Promise<void> {
  await initializeDatabase();
  const identifier = text(data, "identifier").toLowerCase();
  const password = text(data, "password");
  const user = await getDb().collection<UserDocument>("users")
    .findOne({ $or: [{ email_key: identifier }, { mobile: identifier }] });

  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    message("/login", "Email/mobile or password is incorrect.", "error");
  }
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

export async function changeOwnPassword(data: FormData): Promise<void> {
  const user = await requireUser();
  const currentPassword = text(data, "currentPassword");
  const newPassword = text(data, "newPassword");
  const confirmation = text(data, "confirmPassword");
  if (!currentPassword || newPassword.length < 10 || newPassword !== confirmation) {
    message("/account", "Enter your current password, use a new password of at least 10 characters, and confirm it.", "error");
  }

  const database = getDb();
  const users = database.collection<UserDocument>("users");
  const account = await users.findOne({ id: user.id }, { projection: { password_hash: 1 } });
  if (!account || !(await bcrypt.compare(currentPassword, account.password_hash))) {
    message("/account", "Your current password is incorrect.", "error");
  }
  if (await bcrypt.compare(newPassword, account.password_hash)) {
    message("/account", "Choose a password different from your current password.", "error");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await users.updateOne(
    { id: user.id, password_hash: account.password_hash },
    { $set: { password_hash: passwordHash } },
  );
  if (updated.modifiedCount !== 1) message("/account", "Your password changed in another request. Sign in again and retry.", "error");
  await audit(user.id, "user.password.changed", "");
  message("/account", "Your password has been changed.");
}

export async function chooseSubjects(data: FormData): Promise<void> {
  const user = await requireUser(["student"]);
  const ids = [...new Set(data.getAll("subjectIds").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  await withTransaction(async (session) => {
    const subjects = getDb().collection<SubjectDocument>("subjects");
    const availableCount = await subjects.countDocuments({ id: { $in: ids }, active: 1 }, { session });
    if (availableCount !== ids.length) throw new Error("A selected subject is unavailable.");
    const preferences = getDb().collection("student_subjects");
    await preferences.deleteMany({ student_id: user.id }, { session });
    if (ids.length) {
      await preferences.insertMany(ids.map((subjectId) => ({ student_id: user.id, subject_id: subjectId })), { session });
    }
  });
  message("/dashboard", "Your subject preferences are saved.");
}

export async function joinFreeBatch(data: FormData): Promise<void> {
  const user = await requireUser(["student"]);
  const batchId = positiveInt(text(data, "batchId"));
  if (!batchId) message("/batches", "Invalid batch.", "error");
  await initializeDatabase();
  const batch = await getDb().collection<BatchDocument>("batches")
    .findOne({ id: batchId }, { projection: { is_free: 1, published: 1 } });
  if (!batch?.published || !batch.is_free) message("/batches", "This batch is not available for free enrollment.", "error");

  await activateEnrollment(user.id, batchId);
  await audit(user.id, "enrollment.free", String(batchId));
  message("/batches", "You have joined the batch.");
}

export async function requestOfflinePayment(data: FormData): Promise<void> {
  const user = await requireUser(["student"]);
  const batchId = positiveInt(text(data, "batchId"));
  const reference = text(data, "reference").slice(0, 120);
  if (!batchId) message("/batches", "Invalid batch.", "error");

  await initializeDatabase();
  const database = getDb();
  const batch = await database.collection<BatchDocument>("batches")
    .findOne({ id: batchId }, { projection: { price_paise: 1, is_free: 1, published: 1 } });
  if (!batch?.published || batch.is_free) message("/batches", "This batch is not available for offline payment.", "error");
  if (await database.collection<EnrollmentDocument>("enrollments")
    .findOne({ student_id: user.id, batch_id: batchId, status: "active" })) {
    message("/batches", "You are already enrolled in this batch.");
  }

  const payments = database.collection<OfflinePaymentDocument>("offline_payment_requests");
  const existing = await payments.findOne({ student_id: user.id, batch_id: batchId });
  const now = new Date();
  if (existing?.status === "confirmed") message("/batches", "This payment request has already been confirmed.");
  if (existing) {
    const updated = await payments.updateOne(
      { id: existing.id, status: { $in: ["pending", "rejected"] } },
      {
        $set: {
          amount_paise: batch.price_paise,
          reference,
          status: "pending",
          decision_note: "",
          verified_by: null,
          verified_at: null,
          verified_amount_paise: null,
          payment_method: null,
        },
      },
    );
    if (updated.matchedCount !== 1) message("/batches", "This payment request has already been processed.", "error");
  } else {
    try {
      await payments.insertOne({
        id: await nextId("offline_payment_requests"),
        student_id: user.id,
        batch_id: batchId,
        amount_paise: batch.price_paise,
        verified_amount_paise: null,
        payment_method: null,
        reference,
        status: "pending",
        decision_note: "",
        verified_by: null,
        verified_at: null,
        created_at: now,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const updated = await payments.updateOne(
        { student_id: user.id, batch_id: batchId, status: { $in: ["pending", "rejected"] } },
        {
          $set: {
            amount_paise: batch.price_paise,
            reference,
            status: "pending",
            decision_note: "",
            verified_by: null,
            verified_at: null,
            verified_amount_paise: null,
            payment_method: null,
          },
        },
      );
      if (updated.matchedCount !== 1) message("/batches", "This payment request has already been processed.", "error");
    }
  }
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
  if (!requestId || (decision !== "confirmed" && decision !== "rejected")) {
    message("/admin/payments", "Invalid payment decision.", "error");
  }
  if (decision === "confirmed" && (!Number.isFinite(verifiedRupees) || verifiedRupees <= 0 || !paymentMethod)) {
    message("/admin/payments", "Enter the verified amount and collection method before confirming.", "error");
  }

  const database = getDb();
  const payments = database.collection<OfflinePaymentDocument>("offline_payment_requests");
  const request = await payments.findOne({ id: requestId });
  if (!request || request.status !== "pending") message("/admin/payments", "This request is no longer pending.", "error");

  await withTransaction(async (session) => {
    const updated = await payments.updateOne(
      { id: requestId, status: "pending" },
      {
        $set: {
          status: decision,
          decision_note: note,
          verified_by: admin.id,
          verified_at: new Date(),
          verified_amount_paise: decision === "confirmed" ? Math.round(verifiedRupees * 100) : null,
          payment_method: decision === "confirmed" ? paymentMethod : null,
        },
      },
      { session },
    );
    if (updated.modifiedCount !== 1) throw new Error("This payment request has already been processed.");
    if (decision === "confirmed") await activateEnrollment(request.student_id, request.batch_id, session);
    await database.collection<NotificationDocument>("notifications").insertOne({
      id: await nextId("notifications", session),
      user_id: request.student_id,
      message: decision === "confirmed"
        ? "Your offline payment has been verified and your batch is now available."
        : "Your offline payment request was not confirmed. Contact the administrator for details.",
      read_at: null,
      created_at: new Date(),
    }, { session });
    await database.collection<AuditLogDocument>("audit_logs").insertOne({
      id: await nextId("audit_logs", session),
      actor_id: admin.id,
      action: `payment.offline.${decision}`,
      details: String(requestId),
      created_at: new Date(),
    }, { session });
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

  const database = getDb();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await withTransaction(async (session) => {
      const subjects = database.collection<SubjectDocument>("subjects");
      if (await subjects.countDocuments({ id: { $in: subjectIds }, active: 1 }, { session }) !== subjectIds.length) {
        throw new Error("A selected subject is unavailable.");
      }
      const id = await nextId("users", session);
      await database.collection<UserDocument>("users").insertOne({
        id,
        name,
        email,
        email_key: email,
        mobile,
        password_hash: passwordHash,
        role: "teacher",
        active: 1,
        created_at: new Date(),
      }, { session });
      await database.collection("teacher_subjects").insertMany(
        subjectIds.map((subject_id) => ({ teacher_id: id, subject_id })),
        { session },
      );
      await database.collection<AuditLogDocument>("audit_logs").insertOne({
        id: await nextId("audit_logs", session),
        actor_id: admin.id,
        action: "teacher.created",
        details: email,
        created_at: new Date(),
      }, { session });
    });
  } catch (error) {
    if (isUniqueViolation(error)) message("/admin/teachers", "An account with that email already exists.", "error");
    throw error;
  }
  message("/admin/teachers", "Teacher account created. Share the temporary password securely.");
}

export async function toggleTeacher(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const teacherId = positiveInt(text(data, "teacherId"));
  if (!teacherId) message("/admin/teachers", "Invalid teacher.", "error");
  const users = getDb().collection<UserDocument>("users");
  const teacher = await users.findOne({ id: teacherId, role: "teacher" });
  if (!teacher) message("/admin/teachers", "Teacher not found.", "error");
  await users.updateOne({ id: teacherId }, { $set: { active: teacher.active ? 0 : 1 } });
  await audit(admin.id, teacher.active ? "teacher.suspended" : "teacher.activated", String(teacherId));
  message("/admin/teachers", teacher.active ? "Teacher suspended." : "Teacher activated.");
}

export async function createSubject(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const name = text(data, "name");
  const description = text(data, "description").slice(0, 500);
  if (name.length < 2) message("/admin/subjects", "Subject name must be at least 2 characters.", "error");
  try {
    await initializeDatabase();
    await getDb().collection<SubjectDocument>("subjects").insertOne({
      id: await nextId("subjects"),
      name,
      name_key: name.toLocaleLowerCase("en"),
      description,
      active: 1,
    });
  } catch (error) {
    if (isUniqueViolation(error)) message("/admin/subjects", "That subject already exists.", "error");
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

  const database = getDb();
  const id = await withTransaction(async (session) => {
    if (await database.collection<SubjectDocument>("subjects")
      .countDocuments({ id: { $in: subjectIds }, active: 1 }, { session }) !== subjectIds.length) {
      throw new Error("A selected subject is unavailable.");
    }
    const batchId = await nextId("batches", session);
    await database.collection<BatchDocument>("batches").insertOne({
      id: batchId,
      title,
      description,
      price_paise: Math.round(price * 100),
      is_free: price === 0 ? 1 : 0,
      published: 1,
      created_at: new Date(),
    }, { session });
    await database.collection("batch_subjects").insertMany(
      subjectIds.map((subject_id) => ({ batch_id: batchId, subject_id })),
      { session },
    );
    return batchId;
  });
  await audit(admin.id, "batch.created", `${title} (ID ${id})`);
  message("/admin/batches", "Batch created.");
}

export async function toggleBatch(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const batchId = positiveInt(text(data, "batchId"));
  if (!batchId) message("/admin/batches", "Invalid batch.", "error");
  const batches = getDb().collection<BatchDocument>("batches");
  const batch = await batches.findOne({ id: batchId });
  if (!batch) message("/admin/batches", "Batch not found.", "error");
  await batches.updateOne({ id: batchId }, { $set: { published: batch.published ? 0 : 1 } });
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
  await initializeDatabase();
  const database = getDb();
  const subject = await database.collection<SubjectDocument>("subjects").findOne({ id: subjectId, active: 1 });
  if (!subject) message("/teacher/content", "The selected subject is unavailable.", "error");
  if (batchId && !await database.collection<BatchDocument>("batches").findOne({ id: batchId })) {
    message("/teacher/content", "The selected batch is unavailable.", "error");
  }
  await database.collection<ClassDocument>("classes").insertOne({
    id: await nextId("classes"),
    title,
    description,
    subject_id: subjectId,
    teacher_id: user.id,
    batch_id: batchId,
    video_url: videoUrl,
    duration_seconds: duration,
    published,
    created_at: new Date(),
  });
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
  await initializeDatabase();
  const database = getDb();
  const subject = await database.collection<SubjectDocument>("subjects").findOne({ id: subjectId, active: 1 });
  if (!subject) message("/teacher/content", "The selected subject is unavailable.", "error");
  if (batchId && !await database.collection<BatchDocument>("batches").findOne({ id: batchId })) {
    message("/teacher/content", "The selected batch is unavailable.", "error");
  }
  const seriesId = await nextId("reel_series");
  await database.collection<ReelSeriesDocument>("reel_series").insertOne({
    id: seriesId,
    title,
    topic,
    subject_id: subjectId,
    teacher_id: user.id,
    batch_id: batchId,
    published: user.role === "admin" ? 1 : 0,
    created_at: new Date(),
  });
  await audit(user.id, "reel_series.created", title);
  message("/teacher/content", `Series created (ID ${seriesId}). Add reels below.`);
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
  await initializeDatabase();
  const series = await getDb().collection<ReelSeriesDocument>("reel_series")
    .findOne({ id: seriesId }, { projection: { teacher_id: 1, subject_id: 1 } });
  if (!series || (user.role === "teacher" && (series.teacher_id !== user.id || !await teacherOwnsSubject(user.id, user.role, series.subject_id)))) {
    message("/teacher/content", "You do not have permission to edit this series.", "error");
  }
  try {
    await getDb().collection<ReelDocument>("reels").insertOne({
      id: await nextId("reels"),
      series_id: seriesId,
      title,
      description,
      video_url: videoUrl,
      duration_seconds: duration,
      sequence_number: sequence,
      published: user.role === "admin" ? 1 : 0,
      created_at: new Date(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) message("/teacher/content", "That sequence number is already used in this series.", "error");
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
  await initializeDatabase();
  const database = getDb();
  let current: { published: number; teacher_id: number } | null = null;
  let update;
  if (entity === "class") {
    const classes = database.collection<ClassDocument>("classes");
    current = await classes.findOne({ id }, { projection: { published: 1, teacher_id: 1 } });
    update = (published: number) => classes.updateOne({ id }, { $set: { published } });
  } else if (entity === "series") {
    const series = database.collection<ReelSeriesDocument>("reel_series");
    current = await series.findOne({ id }, { projection: { published: 1, teacher_id: 1 } });
    update = (published: number) => series.updateOne({ id }, { $set: { published } });
  } else {
    const reel = await database.collection<ReelDocument>("reels").findOne({ id });
    const series = reel
      ? await database.collection<ReelSeriesDocument>("reel_series").findOne({ id: reel.series_id })
      : null;
    if (reel && series) current = { published: reel.published, teacher_id: series.teacher_id };
    update = (published: number) => database.collection<ReelDocument>("reels").updateOne({ id }, { $set: { published } });
  }
  if (!current || (user.role === "teacher" && current.teacher_id !== user.id)) {
    message(user.role === "admin" ? "/admin/content" : "/teacher/content", "Content not found or access denied.", "error");
  }
  await update(current.published ? 0 : 1);
  await audit(user.id, `${entity}.${current.published ? "unpublished" : "published"}`, String(id));
  message(user.role === "admin" ? "/admin/content" : "/teacher/content", current.published ? "Content unpublished." : "Content published.");
}

export async function saveClassProgress(classId: number, positionSeconds: number): Promise<void> {
  const student = await requireUser(["student"]);
  if (!Number.isSafeInteger(classId) || classId <= 0 || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    throw new Error("Invalid class progress update.");
  }
  await initializeDatabase();
  const database = getDb();
  const item = await database.collection<ClassDocument>("classes").findOne({ id: classId });
  if (!item?.published || !await hasBatchAccess(student.id, item.batch_id)) {
    throw new Error("This class is not available to your account.");
  }
  const position = Math.min(Math.floor(positionSeconds), item.duration_seconds || Math.floor(positionSeconds));
  await database.collection<ClassProgressDocument>("class_progress").updateOne(
    { student_id: student.id, class_id: classId },
    { $set: { position_seconds: position, updated_at: new Date() } },
    { upsert: true },
  );
}

async function getAccessibleReel(reelId: number, studentId: number) {
  const database = getDb();
  const reel = await database.collection<ReelDocument>("reels").findOne({ id: reelId });
  if (!reel) return null;
  const series = await database.collection<ReelSeriesDocument>("reel_series").findOne({ id: reel.series_id });
  if (!series || !reel.published || !series.published || !await hasBatchAccess(studentId, series.batch_id)) return null;
  return { reel, series };
}

export async function beginReel(reelId: number, positionSeconds: number): Promise<void> {
  const student = await requireUser(["student"]);
  if (!Number.isSafeInteger(reelId) || reelId <= 0 || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    throw new Error("Invalid reel progress update.");
  }
  await initializeDatabase();
  const result = await getAccessibleReel(reelId, student.id);
  if (!result) throw new Error("This reel is not available to your account.");
  const database = getDb();
  const now = new Date();
  const progress = await database.collection<ReelProgressDocument>("reel_progress")
    .findOne({ student_id: student.id, reel_id: reelId });
  const position = Math.min(Math.max(0, Math.floor(positionSeconds || 0)), result.reel.duration_seconds);
  await database.collection<ReelProgressDocument>("reel_progress").updateOne(
    { student_id: student.id, reel_id: reelId },
    progress
      ? { $set: { checkpoint_at: now } }
      : {
          $setOnInsert: {
            position_seconds: position,
            watched_seconds: 0,
            completed: 0,
            checkpoint_at: now,
            updated_at: now,
          },
        },
    { upsert: true },
  );
}

export async function saveReelProgress(reelId: number, positionSeconds: number): Promise<void> {
  const student = await requireUser(["student"]);
  if (!Number.isSafeInteger(reelId) || reelId <= 0 || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    throw new Error("Invalid reel progress update.");
  }
  await initializeDatabase();
  const result = await getAccessibleReel(reelId, student.id);
  if (!result) throw new Error("This reel is not available to your account.");
  const progressCollection = getDb().collection<ReelProgressDocument>("reel_progress");
  const existing = await progressCollection.findOne({ student_id: student.id, reel_id: reelId });
  const progress = calculateReelProgress(existing ?? undefined, positionSeconds, result.reel.duration_seconds, new Date());
  await progressCollection.updateOne(
    { student_id: student.id, reel_id: reelId },
    {
      $set: {
        position_seconds: progress.position_seconds,
        watched_seconds: progress.watched_seconds,
        completed: progress.completed,
        checkpoint_at: progress.checkpoint_at,
        updated_at: new Date(),
      },
      $setOnInsert: { student_id: student.id, reel_id: reelId },
    },
    { upsert: true },
  );
}

export async function resetStudentProgress(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const studentId = positiveInt(text(data, "studentId"));
  if (!studentId) message("/admin/students", "Invalid student.", "error");
  await initializeDatabase();
  const database = getDb();
  await Promise.all([
    database.collection<ReelProgressDocument>("reel_progress").deleteMany({ student_id: studentId }),
    database.collection<ClassProgressDocument>("class_progress").deleteMany({ student_id: studentId }),
  ]);
  await audit(admin.id, "student.progress.reset", String(studentId));
  message("/admin/students", "Student learning progress reset.");
}

export async function resetStudentPassword(data: FormData): Promise<void> {
  const admin = await requireUser(["admin"]);
  const studentId = positiveInt(text(data, "studentId"));
  const password = text(data, "newPassword");
  const confirmation = text(data, "confirmPassword");
  if (!studentId) message("/admin/students", "Invalid student.", "error");
  if (password.length < 10 || password !== confirmation) {
    message("/admin/students", "Use a password of at least 10 characters and confirm it.", "error");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const database = getDb();
  const updated = await withTransaction(async (session) => {
    const result = await database.collection<UserDocument>("users").updateOne(
      { id: studentId, role: "student" },
      { $set: { password_hash: passwordHash } },
      { session },
    );
    if (result.matchedCount !== 1) return false;
    await database.collection<SessionDocument>("sessions").deleteMany({ user_id: studentId }, { session });
    await database.collection<AuditLogDocument>("audit_logs").insertOne({
      id: await nextId("audit_logs", session),
      actor_id: admin.id,
      action: "student.password.reset",
      details: String(studentId),
      created_at: new Date(),
    }, { session });
    return true;
  });
  if (!updated) message("/admin/students", "Student account not found.", "error");
  message("/admin/students", "Student password changed and active sessions revoked.");
}

export async function markNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await initializeDatabase();
  await getDb().collection<NotificationDocument>("notifications").updateMany(
    { user_id: user.id, read_at: null },
    { $set: { read_at: new Date() } },
  );
}
