import assert from "node:assert/strict";
import test from "node:test";
import { mapPostgresRow } from "../../scripts/migrate-postgres-to-mongodb.mjs";

test("PostgreSQL user rows preserve IDs and normalize Atlas email keys", () => {
  const createdAt = "2026-11-12T10:00:00.000Z";
  const user = mapPostgresRow("users", {
    id: "42",
    email: "Learner@Example.com",
    created_at: createdAt,
    active: 1,
  });
  assert.equal(user.id, 42);
  assert.equal(user.email_key, "learner@example.com");
  assert.equal(user.created_at.toISOString(), createdAt);
});

test("PostgreSQL relationship rows retain their composite keys", () => {
  const relation = mapPostgresRow("student_subjects", { student_id: "8", subject_id: "3" });
  assert.deepEqual(relation, { student_id: 8, subject_id: 3 });
});

test("PostgreSQL reel checkpoint timestamps become MongoDB dates", () => {
  const checkpoint = mapPostgresRow("reel_progress", {
    student_id: 8,
    reel_id: 15,
    checkpoint_at: "2026-11-12T10:00:00.000Z",
  });
  assert.equal(checkpoint.checkpoint_at.toISOString(), "2026-11-12T10:00:00.000Z");
});

test("PostgreSQL migration rejects malformed IDs and timestamps", () => {
  assert.throws(() => mapPostgresRow("users", { id: "unsafe" }), /Invalid id value in users/);
  assert.throws(() => mapPostgresRow("sessions", { token_hash: "token", created_at: "invalid" }), /Invalid created_at value in sessions/);
});
