import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

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

export async function startSession(userId: number, role: Role): Promise<void> {
  const cookieStore = await cookies();
  const token = randomBytes(32).toString("base64url");
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value ?? randomBytes(16).toString("hex");
  const db = getDb();

  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  const activeSession = await db
    .prepare("SELECT device_id FROM sessions WHERE user_id = ?")
    .get(userId) as { device_id: string } | undefined;

  if (role === "student" && activeSession && activeSession.device_id !== deviceId) {
    throw new Error("This student account is already active on another browser or app installation. Sign out there first.");
  }

  await db.prepare(`
    INSERT INTO sessions (token_hash, user_id, device_id, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      token_hash = excluded.token_hash,
      device_id = excluded.device_id,
      expires_at = excluded.expires_at,
      created_at = datetime('now')
  `).run(
    hashToken(token),
    userId,
    deviceId,
    new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000).toISOString(),
  );

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
  if (token) await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await getDb()
    .prepare(`
      SELECT users.id, users.name, users.email, users.mobile, users.role, users.active
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `)
    .get(hashToken(token), new Date().toISOString()) as User | undefined;
  return user?.active ? user : null;
}

export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?error=Access%20denied");
  return user;
}
