import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: integer("email_verified").notNull().default(0),
  role: text("role").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
  check("users_role_check", sql`${table.role} in ('student', 'teacher', 'admin')`),
]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (table) => [index("idx_sessions_expiration").on(table.expiresAt)]);

export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index("idx_verification_tokens_user").on(table.userId)]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index("idx_password_reset_tokens_user").on(table.userId)]);

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  active: integer("active").notNull().default(1),
}, (table) => [uniqueIndex("subjects_name_lower_unique").on(sql`lower(${table.name})`)]);

export const studentSubjects = pgTable("student_subjects", {
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.studentId, table.subjectId] })]);

export const teacherSubjects = pgTable("teacher_subjects", {
  teacherId: integer("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.teacherId, table.subjectId] })]);

export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  pricePaise: integer("price_paise").notNull().default(0),
  isFree: integer("is_free").notNull().default(1),
  published: integer("published").notNull().default(1),
  createdAt: createdAt(),
}, (table) => [check("batches_price_check", sql`${table.pricePaise} >= 0`)]);

export const batchSubjects = pgTable("batch_subjects", {
  batchId: integer("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.batchId, table.subjectId] })]);

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("enrollments_student_batch_unique").on(table.studentId, table.batchId),
  index("idx_enrollments_student").on(table.studentId, table.status),
  check("enrollments_status_check", sql`${table.status} in ('active', 'revoked')`),
]);

export const offlinePaymentRequests = pgTable("offline_payment_requests", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  amountPaise: integer("amount_paise").notNull(),
  verifiedAmountPaise: integer("verified_amount_paise"),
  paymentMethod: text("payment_method"),
  reference: text("reference").notNull().default(""),
  status: text("status").notNull().default("pending"),
  decisionNote: text("decision_note").notNull().default(""),
  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("offline_payment_student_batch_unique").on(table.studentId, table.batchId),
  check("offline_payment_amount_check", sql`${table.amountPaise} >= 0`),
  check("offline_payment_status_check", sql`${table.status} in ('pending', 'confirmed', 'rejected')`),
]);

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
  videoUrl: text("video_url").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  published: integer("published").notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  index("idx_classes_subject").on(table.subjectId, table.published),
  check("classes_duration_check", sql`${table.durationSeconds} >= 0`),
]);

export const classProgress = pgTable("class_progress", {
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  positionSeconds: integer("position_seconds").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.studentId, table.classId] })]);

export const reelSeries = pgTable("reel_series", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull().default(""),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
  published: integer("published").notNull().default(0),
  createdAt: createdAt(),
});

export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull().references(() => reelSeries.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  videoUrl: text("video_url").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  published: integer("published").notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("reels_series_sequence_unique").on(table.seriesId, table.sequenceNumber),
  index("idx_reels_series").on(table.seriesId, table.sequenceNumber),
  check("reels_duration_check", sql`${table.durationSeconds} > 0`),
  check("reels_sequence_check", sql`${table.sequenceNumber} > 0`),
]);

export const reelProgress = pgTable("reel_progress", {
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reelId: integer("reel_id").notNull().references(() => reels.id, { onDelete: "cascade" }),
  positionSeconds: integer("position_seconds").notNull().default(0),
  watchedSeconds: integer("watched_seconds").notNull().default(0),
  checkpointAt: timestamp("checkpoint_at", { withTimezone: true }).notNull().defaultNow(),
  completed: integer("completed").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.studentId, table.reelId] })]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details").notNull().default(""),
  createdAt: createdAt(),
});
