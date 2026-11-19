import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { MongoClient } from "mongodb";
import { ensureMongoIndexes } from "../../scripts/mongo-indexes.mjs";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;

test("MongoDB Atlas supports transactional writes and rollback", {
  skip: process.env.RUN_MONGODB_INTEGRATION_TESTS !== "true",
}, async () => {
  if (!uri || !databaseName) throw new Error("Set MONGODB_URI and MONGODB_DB before running the Atlas integration test.");
  if (/^mongodb(?:\+srv)?:\/\/USER:PASSWORD@(?:HOST|CLUSTER\.mongodb\.net)(?:\/|$)/i.test(uri)) {
    throw new Error("Replace the MongoDB Atlas example connection string before running the integration test.");
  }
  if (/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(uri)) {
    throw new Error("The Atlas integration test requires MongoDB Atlas, not a local server.");
  }
  const client = new MongoClient(uri, { maxPoolSize: 1 });
  const collectionName = `edureels-test-${randomBytes(8).toString("hex")}`;
  const database = client.db(databaseName);
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await ensureMongoIndexes(database);
    const collection = database.collection(collectionName);
    await collection.insertOne({ value: "committed" });
    const session = client.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await collection.insertOne({ value: "rolled-back" }, { session });
        throw new Error("rollback expected");
      }), /rollback expected/);
    } finally {
      await session.endSession();
    }
    assert.equal(await collection.countDocuments({ value: "committed" }), 1);
    assert.equal(await collection.countDocuments({ value: "rolled-back" }), 0);
  } finally {
    if (connected) {
      await database.dropCollection(collectionName).catch((error) => {
        if (error.codeName !== "NamespaceNotFound") throw error;
      });
    }
    await client.close();
  }
});
