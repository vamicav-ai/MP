import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { MongoClient } from "mongodb";
import { ensureMongoIndexes } from "./mongo-indexes.mjs";

const PLACEHOLDER_POSTGRES_URL = /^postgres(?:ql)?:\/\/USER:PASSWORD@HOST\/DATABASE(?:\?.*)?$/i;
const PLACEHOLDER_MONGODB_URI = /^mongodb(?:\+srv)?:\/\/USER:PASSWORD@(?:HOST|CLUSTER\.mongodb\.net)(?:\/|$)/i;
const TABLES = [
  { name: "users", keys: ["id"], ids: true },
  { name: "sessions", keys: ["token_hash"] },
  { name: "subjects", keys: ["id"], ids: true },
  { name: "student_subjects", keys: ["student_id", "subject_id"] },
  { name: "teacher_subjects", keys: ["teacher_id", "subject_id"] },
  { name: "batches", keys: ["id"], ids: true },
  { name: "batch_subjects", keys: ["batch_id", "subject_id"] },
  { name: "enrollments", keys: ["id"], ids: true },
  { name: "offline_payment_requests", keys: ["id"], ids: true },
  { name: "classes", keys: ["id"], ids: true },
  { name: "class_progress", keys: ["student_id", "class_id"] },
  { name: "reel_series", keys: ["id"], ids: true },
  { name: "reels", keys: ["id"], ids: true },
  { name: "reel_progress", keys: ["student_id", "reel_id"] },
  { name: "notifications", keys: ["id"], ids: true },
  { name: "audit_logs", keys: ["id"], ids: true },
];
const DATE_FIELDS = new Set(["created_at", "expires_at", "verified_at", "updated_at", "read_at", "checkpoint_at"]);
const NUMBER_FIELDS = new Set([
  "id", "user_id", "student_id", "teacher_id", "subject_id", "batch_id", "class_id", "series_id", "reel_id",
  "actor_id", "verified_by", "price_paise", "amount_paise", "verified_amount_paise", "is_free", "published",
  "active", "duration_seconds", "sequence_number", "position_seconds", "watched_seconds", "completed",
]);

export function mapPostgresRow(tableName, row) {
  const document = { ...row };
  const table = TABLES.find((item) => item.name === tableName);
  if (!table) throw new Error(`Unsupported PostgreSQL table: ${tableName}.`);
  for (const key of table.keys) {
    if (document[key] === null || document[key] === undefined) {
      throw new Error(`Missing ${key} value in ${tableName}.`);
    }
  }
  for (const [field, value] of Object.entries(document)) {
    if (value === null || value === undefined) continue;
    if (DATE_FIELDS.has(field)) {
      document[field] = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(document[field].getTime())) throw new Error(`Invalid ${field} value in ${tableName}.`);
    } else if (NUMBER_FIELDS.has(field)) {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error(`Invalid ${field} value in ${tableName}.`);
      document[field] = number;
    }
  }
  if (tableName === "users") document.email_key = String(document.email).toLowerCase();
  if (tableName === "subjects") document.name_key = String(document.name).toLocaleLowerCase("en");
  return document;
}

function getSourceUrl() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim()
    ?? process.env.DATABASE_URL?.trim()
    ?? (process.env.DATABASE_PATH?.trim().startsWith("postgres") ? process.env.DATABASE_PATH.trim() : undefined);
  if (!sourceUrl || !/^postgres(?:ql)?:\/\//i.test(sourceUrl) || PLACEHOLDER_POSTGRES_URL.test(sourceUrl)) {
    throw new Error("Set SOURCE_DATABASE_URL to the existing PostgreSQL connection string in web/.env.");
  }
  return sourceUrl;
}

function getMongoConfig() {
  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//i.test(uri) || PLACEHOLDER_MONGODB_URI.test(uri)) {
    throw new Error("Set MONGODB_URI to the destination MongoDB Atlas connection string in web/.env.");
  }
  if (!databaseName) throw new Error("Set MONGODB_DB to the destination database name in web/.env.");
  return { uri, databaseName };
}

async function importTable(pool, database, table) {
  const { rows } = await pool.query(`SELECT * FROM "${table.name}"`);
  const collection = database.collection(table.name);
  const documents = rows.map((row) => mapPostgresRow(table.name, row));
  for (let offset = 0; offset < documents.length; offset += 500) {
    const batch = documents.slice(offset, offset + 500);
    if (!batch.length) continue;
    await collection.bulkWrite(batch.map((document) => {
      const filter = Object.fromEntries(table.keys.map((key) => [key, document[key]]));
      return { replaceOne: { filter, replacement: document, upsert: true } };
    }), { ordered: true });
  }
  if (table.ids && documents.length) {
    const maxId = documents.reduce((maximum, document) => Math.max(maximum, document.id), 0);
    await database.collection("counters").updateOne(
      { _id: table.name },
      { $max: { value: maxId } },
      { upsert: true },
    );
  }
  console.log(`${table.name}: ${documents.length} records imported`);
}

async function main() {
  const sourceUrl = getSourceUrl();
  const { uri, databaseName } = getMongoConfig();
  const pool = new Pool({ connectionString: sourceUrl, max: 2 });
  const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10_000 });
  try {
    await Promise.all([pool.query("SELECT 1"), client.connect()]);
    const database = client.db(databaseName);
    await ensureMongoIndexes(database);
    for (const table of TABLES) await importTable(pool, database, table);

    const administrator = await database.collection("users").findOne({ role: "admin" }, { projection: { id: 1 } });
    if (administrator) {
      await database.collection("settings").updateOne(
        { _id: "first-admin" },
        { $setOnInsert: { user_id: administrator.id } },
        { upsert: true },
      );
    }
    console.log("PostgreSQL records are copied to Atlas. The import is safe to rerun.");
  } finally {
    await Promise.all([pool.end(), client.close()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL-to-Atlas migration failed.");
    process.exitCode = 1;
  });
}
