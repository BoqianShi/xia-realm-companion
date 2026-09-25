import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePack } from "../scripts/validate-content.mjs";
const demo = () => JSON.parse(readFileSync(new URL("../content/demo.json", import.meta.url), "utf8"));
test("original demo has a valid connected catalog, module and encounter", () => {
  const pack = validatePack(demo());
  assert.equal(pack.modules[0].npcs[0].id, pack.encounters[0].cast[0].npcId);
  assert.equal(pack.catalog.filter(e => e.parentId === "demo-routine").length, 3);
});
test("imports reject duplicate IDs, false parents, missing NPCs and undeclared files", () => {
  let p = demo(); p.catalog.push(p.catalog[0]); assert.throws(() => validatePack(p), /Duplicate/);
  p = demo(); p.catalog.find(e => e.kind === "move").parentId = "demo-inner"; assert.throws(() => validatePack(p), /parent/);
  p = demo(); p.encounters[0].cast[0].npcId = "absent"; assert.throws(() => validatePack(p), /NPC/);
  p = demo(); p.modules[0].cover = "/modules/private.webp"; assert.throws(() => validatePack(p), /Undeclared/);
  for (const path of ["../../secret.txt", "/absolute.txt", "a/../secret.txt", "evil.svg", "a\\evil.png"]) {
    p = demo(); p.assets = [{ path, file: "image.png" }]; assert.throws(() => validatePack(p));
  }
});
