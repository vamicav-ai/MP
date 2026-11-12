import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_PATH;

if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) {
  throw new Error("Set DATABASE_URL to a PostgreSQL connection string before generating or applying database migrations.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: connectionString },
});
