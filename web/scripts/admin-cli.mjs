import { createInterface } from "node:readline/promises";
import { MongoClient } from "mongodb";
import { ensureMongoIndexes } from "./mongo-indexes.mjs";

const PLACEHOLDER_MONGODB_URI = /^mongodb(?:\+srv)?:\/\/USER:PASSWORD@(?:HOST|CLUSTER\.mongodb\.net)(?:\/|$)/i;

export function getMongoConfig() {
  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//i.test(uri) || PLACEHOLDER_MONGODB_URI.test(uri)) {
    throw new Error("Set MONGODB_URI to a MongoDB Atlas connection string in web/.env.");
  }
  if (!databaseName) {
    throw new Error("Set MONGODB_DB to the EduReels database name in web/.env.");
  }
  return { uri, databaseName };
}

export async function connectMongoDatabase() {
  const { uri, databaseName } = getMongoConfig();
  const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const database = client.db(databaseName);
    await ensureMongoIndexes(database);
    return { client, database };
  } catch (error) {
    await client.close();
    throw error;
  }
}

export async function nextId(database, collectionName, session) {
  const result = await database.collection("counters").findOneAndUpdate(
    { _id: collectionName },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", includeResultMetadata: false, session },
  );
  if (!result) throw new Error(`Could not allocate an ID for ${collectionName}.`);
  return result.value;
}

export function isUniqueViolation(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export function requireInteractiveTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in the VS Code integrated terminal so it can prompt for account details.");
  }
}

export async function promptLine(prompt) {
  requireInteractiveTerminal();
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try {
    answer = await readline.question(prompt);
  } finally {
    readline.close();
  }
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("No response was entered. Keep the terminal open and answer the prompt.");
  }
  return answer.trim();
}

export function promptHidden(prompt) {
  requireInteractiveTerminal();
  return new Promise((resolve, reject) => {
    let value = "";
    let completed = false;
    const input = process.stdin;
    const finish = (error, result) => {
      if (completed) return;
      completed = true;
      input.off("data", onData);
      input.off("close", onClose);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Operation cancelled."));
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
    const onClose = () => finish(new Error("Terminal input closed."));

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    input.on("data", onData);
    input.once("close", onClose);
  });
}

export async function promptPassword(prompt = "New password (minimum 12 characters): ") {
  const password = await promptHidden(prompt);
  const confirmation = await promptHidden("Confirm password: ");
  if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  return password;
}
