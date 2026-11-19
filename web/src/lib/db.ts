import "server-only";

import { MongoClient, type ClientSession, type Db } from "mongodb";
import { ensureMongoIndexes } from "../../scripts/mongo-indexes.mjs";
import type { SubjectDocument } from "@/lib/models";

const PLACEHOLDER_MONGODB_URI = /^mongodb(?:\+srv)?:\/\/USER:PASSWORD@(?:HOST|CLUSTER\.mongodb\.net)(?:\/|$)/i;
const DEFAULT_SUBJECTS = [
  ["Mathematics", "Build confidence with clear, step-by-step lessons."],
  ["Physics", "Explore the principles behind the world around us."],
  ["Chemistry", "Understand matter, reactions, and the periodic table."],
  ["Biology", "Learn about living systems from cells to ecosystems."],
] as const;

type CounterDocument = { _id: string; value: number };
type MongoState = {
  client?: MongoClient;
  database?: Db;
  databaseKey?: string;
  initialized?: Promise<void>;
};

const globalForMongo = globalThis as typeof globalThis & { edureelsMongo?: MongoState };
const state = globalForMongo.edureelsMongo ?? (globalForMongo.edureelsMongo = {});

function getMongoConfig(): { uri: string; databaseName: string } {
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

function getClient(): MongoClient {
  const { uri, databaseName } = getMongoConfig();
  const databaseKey = `${uri}\n${databaseName}`;
  if (!state.client || state.databaseKey !== databaseKey) {
    state.client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
    state.database = state.client.db(databaseName);
    state.databaseKey = databaseKey;
    state.initialized = undefined;
  }
  return state.client;
}

export function getDb(): Db {
  getClient();
  if (!state.database) throw new Error("MongoDB database initialization failed.");
  return state.database;
}

export async function nextId(collectionName: string, session?: ClientSession): Promise<number> {
  const database = getDb();
  const result = await database.collection<CounterDocument>("counters").findOneAndUpdate(
    { _id: collectionName },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", includeResultMetadata: false, session },
  );
  if (!result) throw new Error(`Could not allocate an ID for ${collectionName}.`);
  return result.value;
}

export async function withTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  await initializeDatabase();
  const session = getClient().startSession();
  try {
    const result = await session.withTransaction(async () => ({ value: await operation(session) }));
    if (!result) throw new Error("MongoDB transaction did not complete.");
    return result.value;
  } finally {
    await session.endSession();
  }
}

export async function initializeDatabase(): Promise<void> {
  const client = getClient();
  if (!state.initialized) {
    state.initialized = (async () => {
      await client.connect();
      const database = getDb();
      await ensureMongoIndexes(database);
      await seedDefaultSubjects(database);
    })().catch((error: unknown) => {
      state.initialized = undefined;
      throw error;
    });
  }
  await state.initialized;
}

async function seedDefaultSubjects(database: Db): Promise<void> {
  const subjects = database.collection<SubjectDocument>("subjects");
  for (const [name, description] of DEFAULT_SUBJECTS) {
    const nameKey = name.toLocaleLowerCase("en");
    if (await subjects.findOne({ name_key: nameKey })) continue;
    try {
      await subjects.insertOne({
        id: await nextId("subjects"),
        name,
        name_key: nameKey,
        description,
        active: 1,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        if (await subjects.findOne({ name_key: nameKey })) continue;
      }
      throw error;
    }
  }
}
