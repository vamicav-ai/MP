import "server-only";

import { Pool, neonConfig, type WebSocketConstructor } from "@neondatabase/serverless";
import WebSocket from "ws";
import { createDatabaseClient, type TransactionalDatabaseClient } from "@/lib/pg-database";

neonConfig.webSocketConstructor = WebSocket as WebSocketConstructor;

type AppDatabase = TransactionalDatabaseClient;

const globalForDb = globalThis as typeof globalThis & {
  edureelsPool?: Pool;
  edureelsDb?: AppDatabase;
};

export function getDb(): AppDatabase {
  if (globalForDb.edureelsDb) return globalForDb.edureelsDb;

  const connectionString = process.env.DATABASE_URL?.trim()
    ?? (process.env.DATABASE_PATH?.trim().startsWith("postgres")
      ? process.env.DATABASE_PATH.trim()
      : undefined);
  if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("Set DATABASE_URL to a Neon PostgreSQL connection string.");
  }

  const pool = globalForDb.edureelsPool ?? new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  globalForDb.edureelsPool = pool;
  globalForDb.edureelsDb = createDatabaseClient(pool);
  return globalForDb.edureelsDb;
}

export async function initializeDatabase(): Promise<void> {
  await getDb().prepare("SELECT 1").get();
}
