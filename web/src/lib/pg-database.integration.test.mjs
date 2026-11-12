import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import nextEnv from "@next/env";
import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { createDatabaseClient } from "./pg-database.ts";

nextEnv.loadEnvConfig(process.cwd());
neonConfig.webSocketConstructor = WebSocket;

const connectionString = process.env.DATABASE_URL
  ?? (process.env.DATABASE_PATH?.startsWith("postgres") ? process.env.DATABASE_PATH : undefined);

test("Neon client supports query translation and atomic transactions", { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString, max: 1 });
  const db = createDatabaseClient(pool);
  const label = randomBytes(10).toString("hex");
  const email = `db-test-${label}@example.invalid`;
  let userId;

  try {
    await db.transaction(async (tx) => {
      const inserted = await tx.prepare(`
        INSERT INTO users (name, email, mobile, password_hash, role)
        VALUES (?, ?, ?, ?, 'student') RETURNING id
      `).get("Database integration test", email, `+1000${label.slice(0, 7)}`, "unused");
      userId = inserted.id;

      const user = await tx.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      assert.equal(user.name, "Database integration test");

      const updated = await tx.prepare("UPDATE users SET active = 0 WHERE id = ?").run(userId);
      assert.equal(updated.changes, 1);
      await tx.prepare("UPDATE users SET active = 1, created_at = datetime('now') WHERE id = ?").run(userId);

      const subjects = await tx.prepare("SELECT group_concat(name, ', ') AS names FROM subjects").get();
      assert.match(subjects.names, /Mathematics/);

      const studentSubject = tx.prepare("INSERT OR IGNORE INTO student_subjects (student_id, subject_id) VALUES (?, ?)");
      await studentSubject.run(userId, 1);
      const duplicate = await studentSubject.run(userId, 1);
      assert.equal(duplicate.changes, 0);

    });

    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.prepare("INSERT INTO users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, 'student')")
          .run("Rollback test", `rollback-${label}@example.invalid`, `+2000${label.slice(0, 7)}`, "unused");
        throw new Error("rollback expected");
      }),
      /rollback expected/,
    );

    const persisted = await db.prepare("SELECT active FROM users WHERE id = ?").get(userId);
    assert.equal(persisted.active, 1);
    const rolledBack = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE email = ?").get(`rollback-${label}@example.invalid`);
    assert.equal(Number(rolledBack.count), 0);
  } finally {
    if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.end();
  }
});
