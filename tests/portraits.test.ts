import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, emptyCampaign } from "../lib/campaign.ts";
import { createStarter } from "../lib/onboarding.ts";
import { emptyRuntime } from "../lib/rules.ts";
import { campaignSchema, characterSchema, commandSchema } from "../lib/validation.ts";
import { mergePortraits, portraitExport, portraitSchema } from "../lib/portraits.ts";
import { blankUnit, characterUnit, screenProjection } from "../lib/hosting.ts";
import type { Campaign } from "../lib/types.ts";
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=";
const edit = (c: Campaign, type: string, payload: unknown, role = "player") => applyCommand(c, commandSchema.parse({ requestId: crypto.randomUUID(), expectedVersion: 0, by: "头像验收", role, type, payload }));
function start() {
  const c = emptyCampaign(), build = createStarter("侠士").build;
  c.characters.push({ id: "hero", revision: 1, build, runtime: emptyRuntime(build) });
  return c;
}
test("portraits share immutable thumbnails, keep runtime intact, survive exports, and undo safely", () => {
  let c = start();
  const old = structuredClone(c.characters[0]);
  c = edit(c, "savePortrait", { id: "hero", revision: 1, portraitId: "portrait-a", portraits: { "portrait-a": image } });
  assert.equal(c.characters[0].portraitId, "portrait-a");
  assert.deepEqual(c.characters[0].runtime, old.runtime);
  assert.deepEqual(c.characters[0].build, old.build);
  assert.equal(c.characters[0].revision, 2);
  const exported = JSON.parse(JSON.stringify({ character: c.characters[0], portraits: portraitExport(c.portraits, c.characters[0].portraitId) }));
  assert.equal(mergePortraits({}, exported.portraits)[characterSchema.parse(exported.character).portraitId!], image);
  assert.deepEqual(campaignSchema.parse(JSON.parse(JSON.stringify(c))).portraits, c.portraits);
  assert.throws(() => edit(c, "savePortrait", { id: "hero", revision: 1, portraitId: "" }), /已有更新/);
  assert.throws(() => edit(c, "savePortrait", { id: "hero", revision: 2, portraitId: "missing" }), /资料缺失/);
  c = edit(c, "savePortrait", { id: "hero", revision: 2, portraitId: "" });
  c = edit(c, "tableUndo", { id: c.logs[0].id });
  assert.equal(c.characters[0].portraitId, "portrait-a");
  assert.equal(JSON.stringify(c).split(image).length - 1, 1, "history only repeats IDs, not image bytes");
});
test("PC portraits follow the card and NPC uploads use the existing versioned host command and projection visibility", () => {
  let c = start();
  c = edit(c, "savePortrait", { id: "hero", revision: 1, portraitId: "a", portraits: { a: image } });
  const pc = characterUnit(c.characters[0]), npc = { ...blankUnit(), name: "陌生人", portraitId: "b" }, hidden = { ...blankUnit(), hidden: true, portraitId: "b" };
  c = edit(c, "host", { revision: 0, operation: { kind: "add", units: [pc, npc, hidden], portraits: { b: image } } }, "dm");
  const projected = screenProjection(c);
  assert.equal(projected.board.units.length, 2);
  assert.ok(projected.board.units.every((u) => u.portrait === image));
  assert.equal(projected.board.units[1].hp, null);
  assert.equal(c.hosting!.history[0].board.units.length, 0);
  assert.throws(() => edit(c, "host", { revision: 0, operation: { kind: "edit", unit: npc } }, "dm"), /已有更新/);
  assert.throws(() => edit(c, "host", { revision: 1, operation: { kind: "edit", unit: { ...npc, portraitId: "absent" } } }, "dm"), /资料缺失/);
  assert.throws(() => edit(c, "host", { revision: 1, operation: { kind: "edit", unit: npc, portraits: { bad: image } } }), /主持人/);
  c = edit(c, "host", { revision: 1, operation: { kind: "edit", unit: { ...npc, portraitId: "" } } }, "dm");
  c = edit(c, "host", { revision: 2, operation: { kind: "undo" } }, "dm");
  assert.equal(screenProjection(c).board.units[1].portrait, image);
});
test("portraits reject remote URLs, executable formats, oversized data and conflicting IDs", () => {
  assert.equal(portraitSchema.safeParse(image).success, true);
  for (const value of ["https://example.com/avatar.png", "data:image/svg+xml;base64,AAAA", "javascript:alert(1)", "data:image/png;base64," + "A".repeat(24000)])
    assert.equal(portraitSchema.safeParse(value).success, false);
  assert.throws(() => mergePortraits({ a: image }, { a: "data:image/png;base64,AAAA" }), /冲突/);
});
