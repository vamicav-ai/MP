import bcrypt from "bcryptjs";
import {
  connectMongoDatabase,
  nextId,
  promptLine,
  promptPassword,
  requireInteractiveTerminal,
} from "./admin-cli.mjs";

async function main() {
  requireInteractiveTerminal();
  const email = (await promptLine("Admin email: ")).toLowerCase();
  if (!email.includes("@")) throw new Error("Enter a valid admin email.");

  const password = await promptPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const { client, database } = await connectMongoDatabase();
  try {
    await client.withSession(async (session) => {
      await session.withTransaction(async () => {
        const users = database.collection("users");
        const admin = await users.findOne({ email_key: email, role: "admin", active: 1 }, { session });
        if (!admin) throw new Error("No active administrator matches that email.");

        await users.updateOne({ id: admin.id }, { $set: { password_hash: passwordHash } }, { session });
        await database.collection("sessions").deleteMany({ user_id: admin.id }, { session });
        await database.collection("audit_logs").insertOne({
          id: await nextId(database, "audit_logs", session),
          actor_id: null,
          action: "admin.password_reset.cli",
          details: `user_id=${admin.id}`,
          created_at: new Date(),
        }, { session });
      });
    });
    console.log("Admin password updated. Sign in with the new password; previous sessions were revoked.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Administrator password reset failed.");
  process.exitCode = 1;
});
