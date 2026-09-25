import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createStarter } from "../lib/onboarding.ts";
// Fresh, disposable D1. Never test writes against a caller-provided URL or existing save.
const state = await mkdtemp(join(tmpdir(), "xia-smoke-"));
const cli = "node_modules/wrangler/bin/wrangler.js";
const port = 5199, base = `http://127.0.0.1:${port}`;
const env = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: ".wrangler/logs", CLOUDFLARE_CF_FETCH_ENABLED: "false" };
let server, logs = "";
try {
  const migrate = spawnSync(process.execPath, [cli, "d1", "migrations", "apply", "DB", "--local", "--persist-to", state], { env, encoding: "utf8" });
  assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  server = spawn(process.execPath, [cli, "dev", "--config", "dist/server/wrangler.json", "--local", "--port", String(port), "--persist-to", state, "--inspector-port", "0"], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", b => { logs += b; }); server.stderr.on("data", b => { logs += b; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try { ready = (await fetch(`${base}/api/campaign`, { signal: AbortSignal.timeout(1500) })).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 400));
  }
  assert.ok(ready, logs);
  let envelope = await (await fetch(`${base}/api/campaign`)).json();
  assert.equal(envelope.campaign.characters.length, 0, "isolated test database must start empty");
  const post = async command => {
    const response = await fetch(`${base}/api/campaign`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(command) });
    return { status: response.status, data: await response.json() };
  };
  const command = (type, payload, version = envelope.version) => ({ requestId: crypto.randomUUID(), expectedVersion: version, by: "原创演示验收", role: "player", type, payload });
  const save = command("saveBuild", { id: "smoke-hero", revision: 0, build: createStarter("演示旅人").build, mode: "creation" });
  let result = await post(save); assert.equal(result.status, 200, JSON.stringify(result.data)); envelope = result.data;
  assert.equal(envelope.campaign.characters.length, 1);
  const hp = envelope.campaign.characters[0].runtime.hp;
  const spend = command("tableEdit", { id: "smoke-hero", revision: 1, operation: { kind: "resource", field: "hp", mode: "subtract", value: 3 } });
  const duplicates = await Promise.all([post(spend), post(spend)]);
  for (const d of duplicates) { assert.equal(d.status, 200, JSON.stringify(d.data)); assert.equal(d.data.campaign.characters[0].runtime.hp, hp - 3); }
  envelope = duplicates[0].data;
  const competing = await Promise.all([1, 2].map(value => post(command("tableEdit", { id: "smoke-hero", revision: 2, operation: { kind: "resource", field: "mp", mode: "subtract", value } }))));
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
  for (const path of ["/", "/screen", "/adventures/demo-rain-pavilion", "/modules/demo-rain-pavilion/content.json"]) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 50, path);
  }
  assert.equal((await fetch(base + "/api/screen")).status, 200);
  console.log("Worker smoke passed: original starter, D1 saves, duplicate requests, conflicts, reader and projector.");
} catch (error) { console.error(logs.slice(-8000)); throw error; }
finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await new Promise(resolve => server.once("exit", resolve)); }
  await rm(state, { recursive: true, force: true });
}
