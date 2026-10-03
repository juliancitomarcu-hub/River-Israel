import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  NODE_ENV: "test", ISOLATED_REVIEW: "true", AUTOMATION_ENABLED: "false",
  INSTAGRAM_DELIVERY_MODE: "disabled",
  DATABASE_URL: "postgres://review:review@127.0.0.1:1/review_only",
};
const result = spawnSync(process.execPath, [
  "--disable-warning=ExperimentalWarning",
  "--import", resolve(root, "scripts/offline-network-deny.mjs"),
  "--test",
  resolve(root, "artifacts/api-server/tests/offline-policy.test.mjs"),
  resolve(root, "artifacts/api-server/tests/instagram.test.mjs"),
], { cwd: root, env, stdio: "inherit", timeout: 30_000 });
if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}