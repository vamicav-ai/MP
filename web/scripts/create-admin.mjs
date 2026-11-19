import bcrypt from "bcryptjs";
import {
  connectMongoDatabase,
  isUniqueViolation,
  nextId,
  promptLine,
  promptPassword,
  requireInteractiveTerminal,
} from "./admin-cli.mjs";

async function main() {
  requireInteractiveTerminal();
  const name = await promptLine("Admin full name: ");
  const email = (await promptLine("Admin email: ")).toLowerCase();
  const mobile = await promptLine("Admin mobile: ");
  if (!email.includes("@")) throw new Error("Enter a valid admin email.");

  const password = await promptPassword("Admin password (minimum 12 characters): ");
  const passwordHash = await bcrypt.hash(password, 12);
  const { client, database } = await connectMongoDatabase();
  try {
    await client.withSession(async (session) => {
      await session.withTransaction(async () => {
        const users = database.collection("users");
        if (await users.findOne({ role: "admin", active: 1 }, { session })) {
          throw new Error("An active administrator already exists. Use npm run admin:reset-password instead.");
        }

        const userId = await nextId(database, "users", session);
        await users.insertOne({
          id: userId,
          name,
          email,
          email_key: email,
          mobile,
          password_hash: passwordHash,
          role: "admin",
          active: 1,
          created_at: new Date(),
        }, { session });
        await database.collection("audit_logs").insertOne({
          id: await nextId(database, "audit_logs", session),
          actor_id: null,
          action: "admin.created.cli",
          details: `user_id=${userId}`,
          created_at: new Date(),
        }, { session });
      });
    });
    console.log("Administrator created. Sign in with the email or mobile number and password you entered.");
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("That email is already in use.");
    throw error;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Administrator creation failed.");
  process.exitCode = 1;
});
