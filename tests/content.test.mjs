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
test("private packs preserve Chinese NPC IDs, PDF page links, legacy attachments and separate encounter-only people", () => {
  const p = demo(), m = p.modules[0];
  m.pdf = "/modules/demo/source.pdf";
  p.assets = [
    { file: "source.pdf", path: "demo/source.pdf" },
    { file: "notes.doc", path: "demo/notes.doc" },
    { file: "stats.xls", path: "demo/stats.xls" },
  ];
  m.assets.push({ id: "notes", name: "原始人物附件", kind: "文档", url: "/modules/demo/notes.doc", size: 8 });
  const extra = { ...structuredClone(m.npcs[0]), id: "demo-桥边旅人／同伴", url: m.pdf + "#page=2", sourcePage: 2 };
  p.encounterPeople = { [m.id]: [extra] };
  p.encounters[0].cast[0].npcId = extra.id;
  p.encounterVersion = "encounter-demo-2";
  p.starter.backgroundGrant = { moves: [], equipment: [], quantities: {}, silver: 0, previousWeapon: "", warnings: [] };
  p.catalog.find(e => e.formula).formula.action = "simple";
  const parsed = validatePack(p);
  assert.deepEqual(parsed, p);
  assert.equal(parsed.modules[0].npcs.some(n => n.id === extra.id), false, "encounter supplements do not rewrite the source module");
  p.encounterPeople[m.id].push(extra);
  assert.throws(() => validatePack(p), /Duplicate/);
});
test("PDF fragments still require declared assets and valid NPC page references", () => {
  for (const url of ["/modules/absent.pdf#page=2", "https://example.com/book.pdf#page=2", "/modules/a.pdf#page=0", "/modules/a.pdf?download=1", "/modules/../a.pdf#page=2"]) {
    const p = demo(); p.modules[0].npcs[0].url = url; assert.throws(() => validatePack(p));
  }
  const p = demo();
  p.encounterPeople = { [p.modules[0].id]: [{ ...p.modules[0].npcs[0], sourcePage: 100 }] };
  assert.throws(() => validatePack(p), /Invalid NPC page/);
  p.encounterPeople = { missing: [] };
  assert.throws(() => validatePack(p), /Unknown encounter NPC module/);
});
