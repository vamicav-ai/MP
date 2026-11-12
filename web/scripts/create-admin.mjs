import bcrypt from "bcryptjs";
import {
  createDatabasePool,
  getConnectionString,
  promptLine,
  promptPassword,
  requireInteractiveTerminal,
} from "./admin-cli.mjs";

function isUniqueViolation(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function main() {
  requireInteractiveTerminal();
  const connectionString = getConnectionString();
  const name = await promptLine("Admin full name: ");
  const email = (await promptLine("Admin email: ")).toLowerCase();
  const mobile = await promptLine("Admin mobile: ");
  if (!email.includes("@")) throw new Error("Enter a valid admin email.");

  const password = await promptPassword("Admin password (minimum 12 characters): ");
  const passwordHash = await bcrypt.hash(password, 12);
  const pool = createDatabasePool(connectionString);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM users WHERE role = 'admin' AND active = 1 LIMIT 1 FOR UPDATE",
    );
    if (existing.rowCount) {
      throw new Error("An active administrator already exists. Use npm run admin:reset-password instead.");
    }

    const created = await client.query(
      `INSERT INTO users (name, email, mobile, password_hash, email_verified, role, active)
       VALUES ($1, $2, $3, $4, 1, 'admin', 1) RETURNING id`,
      [name, email, mobile, passwordHash],
    );
    const userId = created.rows[0].id;
    await client.query(
      "INSERT INTO audit_logs (actor_id, action, details) VALUES (NULL, 'admin.created.cli', $1)",
      [`user_id=${userId}`],
    );
    await client.query("COMMIT");
    console.log("Administrator created. Sign in with the email or mobile number and password you entered.");
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      throw new Error("That email or mobile number is already in use.");
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Administrator creation failed.");
  process.exitCode = 1;
});
