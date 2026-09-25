import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, emptyCampaign } from "../lib/campaign.ts";
import { createStarter } from "../lib/onboarding.ts";
import { emptyRuntime, calculateCharacter, calculateMove } from "../lib/rules.ts";
import { named, effectiveMoves, getEntry } from "../lib/catalog.ts";
import { campaignSchema, commandSchema } from "../lib/validation.ts";
import {
  emptyHosting,
  blankUnit,
  characterUnit,
  npcUnit,
  applyHost,
  screenProjection,
  visibleUnit,
  hostingSchema,
  rollInitiativeDie,
} from "../lib/hosting.ts";
import type { Campaign } from "../lib/types.ts";
import type { ModuleContent } from "../lib/module-types.ts";
const start = () => {
  const c = emptyCampaign(),
    build = createStarter("主持台验收").build;
  c.characters = [
    { id: "hero", revision: 1, build, runtime: emptyRuntime(build) },
  ];
  return c;
};
const edit = (
  c: Campaign,
  operation: unknown,
  role = "dm",
  revision = c.hosting?.revision ?? 0,
) =>
  applyCommand(
    c,
    commandSchema.parse({
      requestId: crypto.randomUUID(),
      expectedVersion: 0,
      by: "验收",
      role,
      type: role === "dm" ? "host" : "hostRoll",
      payload: { revision, operation },
    }),
  );
const unit = (name: string, score: number) => ({
  ...blankUnit(),
  name,
  score,
  hp: 40,
  hpMax: 50,
  mp: 10,
  mpMax: 20,
  conditions: "流血 3 层 · 持续 2 回合",
});

test("offline-table round tracking advances a whole round, skips unavailable units, and can be undone without bookkeeping", () => {
  let c = start();
  const pc = { ...characterUnit(c.characters[0]), score: 12 }, enemy = unit("山贼", 8);
  c = edit(c, { kind: "add", units: [{ ...unit("退场人物", 20), out: true }, pc, enemy, { ...unit("援军", 5), reserve: true }] });
  c = edit(c, { kind: "start" });
  const before = structuredClone(c);
  assert.equal(screenProjection(c).board.trackingMode, "round");
  assert.equal(screenProjection(c).board.activeId, null);
  c = edit(c, { kind: "nextRound" });
  assert.equal(c.hosting!.board.round, 2);
  assert.equal(c.hosting!.board.activeId, pc.id);
  assert.deepEqual(c.hosting!.board.units, before.hosting!.board.units);
  assert.deepEqual(c.characters, before.characters);
  assert.equal(c.hosting!.history[0].label, "进入第 2 轮");
  c = edit(c, { kind: "undo" });
  assert.deepEqual(c.hosting!.board, before.hosting!.board);
  c = edit(c, { kind: "setActive", id: enemy.id });
  assert.equal(c.hosting!.board.round, 1);
  assert.equal(c.hosting!.board.trackingMode, "turn");
  assert.equal(screenProjection(c).board.activeId, enemy.id);
  assert.deepEqual(c.hosting!.board.units, before.hosting!.board.units);
  c = edit(c, { kind: "nextRound" });
  assert.equal(c.hosting!.board.round, 2);
  assert.equal(c.hosting!.board.activeId, pc.id);
  c = edit(c, { kind: "pause" });
  assert.throws(() => edit(c, { kind: "nextRound" }), /开始或继续/);
  c = edit(c, { kind: "setActive", id: enemy.id });
  assert.equal(c.hosting!.board.status, "paused");
  assert.equal(c.hosting!.board.round, 2);
  assert.throws(() => edit(c, { kind: "setActive", id: before.hosting!.board.units[0].id }), /仍在场/);
  assert.throws(() => edit(c, { kind: "setActive", id: before.hosting!.board.units[3].id }), /仍在场/);
  assert.throws(() => edit(c, { kind: "setActive", id: "absent" }), /不存在/);
  c = edit(c, { kind: "trackingMode", mode: "round" });
  c = edit(c, { kind: "out", id: enemy.id, out: true });
  assert.equal(c.hosting!.board.round, 2, "removing the last unit in order does not advance a manually tracked round");
  assert.deepEqual(c.characters, before.characters);
});

test("automatic initiative rejects biased random tail and can roll every D20 face", (t) => {
  const draws = [4294967295, 4294967280, ...Array.from({ length: 20 }, (_, i) => i)];
  t.mock.method(crypto, "getRandomValues", (buffer: Uint32Array) => {
    buffer[0] = draws.shift()!;
    return buffer;
  });
  assert.deepEqual(Array.from({ length: 20 }, () => rollInitiativeDie()), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(draws.length, 0);
});

test("batch auto initiative uses current PC bonuses, rolls only eligible units, sorts stable ties and safely undoes", (t) => {
  t.mock.method(crypto, "getRandomValues", (buffer: Uint32Array) => { buffer[0] = 9; return buffer; });
  let c = start();
  const pc = { ...characterUnit(c.characters[0]), bonus: 999 },
    fixed = unit("已定先攻", 100),
    one = { ...unit("甲", 0), score: null, bonus: 2 },
    two = { ...unit("乙", 0), score: null, bonus: 2 },
    unknown = { ...blankUnit(), name: "资料缺先攻" },
    reserve = { ...one, id: "reserve", reserve: true },
    out = { ...one, id: "out", out: true },
    offstage = { ...one, id: "offstage", offstage: true };
  c = edit(c, { kind: "add", units: [pc, fixed, one, two, unknown, reserve, out, offstage] });
  const before = structuredClone(c);
  c = edit(c, { kind: "rollAll" });
  const board = c.hosting!.board, get = (id: string) => board.units.find((u) => u.id === id)!;
  assert.equal(get(pc.id).score, 10 + calculateCharacter(c.characters[0].build).initiative);
  assert.equal(get(one.id).score, 12);
  assert.equal(get(two.id).score, 12);
  assert.ok(board.units.indexOf(get(one.id)) < board.units.indexOf(get(two.id)));
  assert.deepEqual(get(fixed.id), fixed);
  for (const u of [unknown, reserve, out, offstage]) assert.deepEqual(get(u.id), u);
  const scores = board.units.filter((u) => !u.reserve && !u.out && !u.offstage).map((u) => u.score ?? -Infinity);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(board.status, "setup");
  assert.equal(board.round, 0);
  assert.deepEqual(c.characters, before.characters);
  assert.deepEqual(c.encounter, before.encounter);
  assert.throws(() => edit(c, { kind: "rollAll" }), /没有待掷骰/);
  assert.throws(() => edit(c, { kind: "autoRoll", id: unknown.id }), /补充.*加值/);
  c = edit(c, { kind: "undo" });
  assert.deepEqual(c.hosting!.board, before.hosting!.board);
});
