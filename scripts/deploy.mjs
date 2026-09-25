import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = JSON.parse(readFileSync("wrangler.json", "utf8"));
if (config.d1_databases.some(db => db.database_id === "00000000-0000-4000-8000-000000000000"))
  throw Error("先创建自己的 D1 数据库，并将 database_id 填入 wrangler.json。详见 docs/DEPLOYMENT.md。");
for (const args of [["run", "build"], ["exec", "wrangler", "--", "deploy", "--config", "dist/server/wrangler.json"]]) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
}
