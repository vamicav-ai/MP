import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, initializeDatabase, withTransaction } from "@/lib/db";
import type { SessionDocument, UserDocument } from "@/lib/models";

export type Role = "student" | "teacher" | "admin";

export type User = {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  active: number;
};

const SESSION_COOKIE = "edureels_session";
const DEVICE_COOKIE = "edureels_device";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function startSession(userId: number, role: Role): Promise<void> {
  const cookieStore = await cookies();
  const token = randomBytes(32).toString("base64url");
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value ?? randomBytes(16).toString("hex");
  await initializeDatabase();
  const sessions = getDb().collection<SessionDocument>("sessions");
  const now = new Date();
  const session: SessionDocument = {
    token_hash: hashToken(token),
    user_id: userId,
    device_id: deviceId,
    expires_at: new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000),
    created_at: now,
  };
  await sessions.deleteMany({ expires_at: { $lte: now } });
  try {
    await withTransaction(async (transaction) => {
      const filter = role === "student"
        ? { user_id: userId, $or: [{ device_id: deviceId }, { expires_at: { $lte: now } }] }
        : { user_id: userId };
      await sessions.findOneAndUpdate(
        filter,
        { $set: session },
        { upsert: true, returnDocument: "after", includeResultMetadata: false, session: transaction },
      );
    });
  } catch (error) {
    if (role === "student" && isDuplicateKey(error)) {
      const activeSession = await sessions.findOne({ user_id: userId, expires_at: { $gt: now } });
      if (activeSession && activeSession.device_id !== deviceId) {
        throw new Error("This student account is already active on another browser or app installation. Sign out there first.");
      }
    }
    throw error;
  }

  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await initializeDatabase();
    await getDb().collection<SessionDocument>("sessions").deleteOne({ token_hash: hashToken(token) });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await initializeDatabase();
  const database = getDb();
  const session = await database.collection<SessionDocument>("sessions")
    .findOne({ token_hash: hashToken(token), expires_at: { $gt: new Date() } });
  if (!session) return null;
  const user = await database.collection<UserDocument>("users").findOne({ id: session.user_id });
  if (!user?.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    active: user.active,
  };
}

export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?error=Access%20denied");
  return user;
}
