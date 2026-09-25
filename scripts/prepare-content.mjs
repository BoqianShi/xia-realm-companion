import { readFile, mkdir, writeFile, rm, cp, realpath } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePack } from "./validate-content.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const input = resolve(process.env.XIA_CONTENT_PACK || resolve(root, "content/demo.json"));
const pack = validatePack(JSON.parse(await readFile(input, "utf8")));
await mkdir(resolve(root, ".local-content"), { recursive: true });
const lock = resolve(root, ".local-content/prepare.lock");
let acquired = false;
for (let attempt = 0; attempt < 100; attempt++) {
  try { await mkdir(lock); acquired = true; break; }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    await new Promise(r => setTimeout(r, 100));
  }
}
if (!acquired) throw Error("Another content import is running. If it was interrupted, remove .local-content/prepare.lock and retry.");
try {
// Only generated directories are replaced. A failed validation leaves old content intact.
const stage = resolve(root, ".local-content/staging");
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const asset of pack.assets || []) {
  const base = await realpath(dirname(input));
  const source = await realpath(resolve(base, asset.file));
  if (!source.startsWith(base + sep)) throw Error(`Asset escapes pack directory: ${asset.file}`);
  const target = resolve(stage, asset.path);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target);
}
for (const module of pack.modules) {
  module.contentUrl = `/modules/${module.id}/content.json`;
  const target = resolve(stage, module.id, "content.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(module));
}
await rm(resolve(root, "public/modules"), { recursive: true, force: true });
await cp(stage, resolve(root, "public/modules"), { recursive: true });
await rm(stage, { recursive: true, force: true });
await writeFile(resolve(root, ".local-content/pack.json"), JSON.stringify(pack, null, 2) + "\n");
console.log(`Content: ${pack.title} (${pack.revision}), ${pack.catalog.length} entries, ${pack.modules.length} modules.`);

} finally { await rm(lock, { recursive: true, force: true }); }
