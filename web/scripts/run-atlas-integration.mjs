import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const result = spawnSync(
  process.execPath,
  ["--test", "src/lib/mongodb.integration.test.mjs"],
  {
    stdio: "inherit",
    env: { ...process.env, RUN_MONGODB_INTEGRATION_TESTS: "true" },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
