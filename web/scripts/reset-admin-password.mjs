import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal so the password can be entered without echo.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Password reset cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(null, value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    const finish = (error, result) => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    };

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    input.on("data", onData);
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in the VS Code integrated terminal so it can prompt for your admin email and password.");
  }

  const connectionString = process.env.DATABASE_URL?.trim()
    || process.env.DATABASE_PATH?.trim();
  if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("Set DATABASE_URL to a PostgreSQL connection string in web/.env.");
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let email;
  try {
    const answer = await readline.question("Admin email: ");
    email = typeof answer === "string" ? answer.trim().toLowerCase() : "";
  } finally {
    readline.close();
  }
  if (!email) throw new Error("No admin email was entered. Keep the terminal open and type it at the prompt.");
  if (!email.includes("@")) throw new Error("Enter a valid admin email.");

  const password = await readHidden("New password (minimum 12 characters): ");
  const confirmation = await readHidden("Confirm new password: ");
  if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const pool = new Pool({ connectionString, max: 1 });
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
