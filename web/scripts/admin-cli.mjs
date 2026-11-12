import { createInterface } from "node:readline";
import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

export function requireInteractiveTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in the VS Code integrated terminal so it can prompt for account details.");
  }
}

export function getConnectionString() {
  const connectionString = process.env.DATABASE_URL?.trim()
    || process.env.DATABASE_PATH?.trim();
  if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("Set DATABASE_URL to a PostgreSQL connection string in web/.env.");
  }
  return connectionString;
}

export function createDatabasePool(connectionString) {
  return new Pool({ connectionString, max: 1 });
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
