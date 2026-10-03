import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertServerAllowed, automationAllowed, makeAllowed, directAllowed, instagramDeliveryMode } from "../src/lib/runtime-policy.ts";

test("isolated review fails closed regardless of supplied production flags", () => {
  const env = { ISOLATED_REVIEW: "true", AUTOMATION_ENABLED: "true", INSTAGRAM_DELIVERY_MODE: "direct", INSTAGRAM_ENABLED: "true", NODE_ENV: "production" };
  assert.throws(() => assertServerAllowed(env), /server and manual endpoints are disabled/);
  assert.equal(automationAllowed(env), false);
  assert.equal(instagramDeliveryMode(env), "disabled");
  assert.equal(makeAllowed(env), false);
  assert.equal(directAllowed(env), false);
});
test("delivery modes are exclusive and invalid values fail closed", () => {
  for (const mode of ["disabled", "make", "direct"]) {
    const env = { INSTAGRAM_DELIVERY_MODE: mode };
    assert.equal(Number(makeAllowed(env)) + Number(directAllowed(env)), mode === "disabled" ? 0 : 1);
  }
  assert.equal(instagramDeliveryMode({ ISOLATED_REVIEW: "true" }), "disabled");
  assert.equal(instagramDeliveryMode({}), "make");
  assert.equal(makeAllowed({ AUTOMATION_ENABLED: "false", INSTAGRAM_DELIVERY_MODE: "make" }), false);
  assert.throws(() => instagramDeliveryMode({ INSTAGRAM_DELIVERY_MODE: "both" }));
});
test("entrypoint checks policy before app import; automatic entrypoints have guards", () => {
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const index = src("../src/index.ts");
  assert.ok(index.indexOf("assertServerAllowed();") < index.indexOf('await import("./app")'));
  assert.doesNotMatch(index, /^import .* from "\.\/app"/m);
  const scheduler = src("../src/scheduler.ts");
  assert.match(scheduler, /function iniciarActualizadorPlantel\(\): void \{\s*if \(!automationAllowed\(\)\) return;/);
  assert.match(scheduler, /function iniciarScheduler\(\): void \{\s*if \(!automationAllowed\(\)\) return;/);
  const worker = src("../src/lib/instagram-worker.ts");
  assert.match(worker, /function procesarInstagram\(\): Promise<void> \{\s*if \(!directAllowed\(\)\) return;/);
  assert.match(worker, /function iniciarInstagram\(\): Promise<void> \{\s*if \(!directAllowed\(\)\) return;/);
  assert.doesNotMatch(worker, /\b(?:CREATE TABLE|ALTER TABLE|CREATE TRIGGER|DROP TRIGGER|INSERT INTO instagram_publicaciones)\b/i);
  const make = src("../src/lib/enviar-a-make.ts");
  assert.match(make, /function enviarNotaAMake\(nota: NotaParaMake\): void \{\s*if \(!makeAllowed\(\)\) return;/);
});
test("isolated API entrypoint rejects before app import or port bind", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const result = spawnSync(process.execPath, [
    "--import", new URL("../../../scripts/offline-network-deny.mjs", import.meta.url).pathname,
    new URL("../src/index.ts", import.meta.url).pathname,
  ], { cwd: root, env: { ISOLATED_REVIEW: "true", AUTOMATION_ENABLED: "false",
    INSTAGRAM_DELIVERY_MODE: "disabled", PORT: "1" }, encoding: "utf8", timeout: 5000 });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /server and manual endpoints are disabled/);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|Server listening/);
});
test("session user-agent and pointerdown handling remain in base", () => {
  const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(src("../src/lib/edit-tokens.ts"), /userAgent: sessionDevice\(userAgent\)/);
  assert.match(src("../src/routes/admin.ts"), /createAdminSession\(req\.get\("user-agent"\)\)/);
  assert.match(src("../../../lib/db/src/schema/panel-sessions.ts"), /userAgent: text\("user_agent"\)/);
  assert.match(src("../../../artifacts/river-en-israel/src/pages/Redactor.tsx"), /addEventListener\("pointerdown", onPointerOutside, true\)/);
});