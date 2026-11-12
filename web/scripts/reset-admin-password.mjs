import bcrypt from "bcryptjs";
import {
  createDatabasePool,
  getConnectionString,
  promptLine,
  promptPassword,
  requireInteractiveTerminal,
} from "./admin-cli.mjs";

async function main() {
  requireInteractiveTerminal();
  const connectionString = getConnectionString();
  const email = (await promptLine("Admin email: ")).toLowerCase();
  if (!email.includes("@")) throw new Error("Enter a valid admin email.");

  const password = await promptPassword();

  const pool = createDatabasePool(connectionString);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT id FROM users WHERE lower(email) = $1 AND role = 'admin' AND active = 1 FOR UPDATE",
      [email],
    );
    if (result.rowCount !== 1) throw new Error("No active administrator matches that email.");

    const userId = result.rows[0].id;
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await client.query(
      "INSERT INTO audit_logs (actor_id, action, details) VALUES (NULL, 'admin.password_reset.cli', $1)",
      [`user_id=${userId}`],
    );
    await client.query("COMMIT");
    console.log("Admin password updated. Sign in with the new password; previous sessions were revoked.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Admin password reset failed.");
  process.exitCode = 1;
});
