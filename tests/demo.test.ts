import test from "node:test";
import assert from "node:assert/strict";
import { createStarter, saveBuildProblems } from "../lib/onboarding.ts";
import { calculateCharacter, calculateMove, emptyRuntime, defaultRules } from "../lib/rules.ts";
import { buildSchema } from "../lib/validation.ts";
import { getEntry } from "../lib/catalog.ts";
import { groupMoves } from "../lib/move-book.ts";
import { stanceReference } from "../lib/table-effects.ts";
test("starter is saveable without any official content, with all three move types in one routine", () => {
  const b = createStarter("旅人").build;
  assert.deepEqual(buildSchema.parse(b), b);
  assert.deepEqual(saveBuildProblems(b, undefined, defaultRules), []);
  const groups = groupMoves(b.moves);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "雨亭短棍");
  assert.deepEqual(b.favorites, ["demo-routine"]);
  assert.deepEqual(new Set(b.moves.map(m => getEntry(m.id)?.moveType)), new Set(["实招", "虚招", "架招"]));
});
test("demo calculation gives finite damage, stage growth, guard and independent runtime", () => {
  const b = createStarter("旅人").build;
  const runtime = emptyRuntime(b), saved = structuredClone(b);
  const first = calculateMove(b, "demo-strike", 1), second = calculateMove(b, "demo-strike", 2);
  assert.ok(first.damage !== null && Number.isFinite(first.damage));
  assert.equal(second.damage! - first.damage!, 3);
  assert.ok(stanceReference(b, "demo-stance").block! > 0);
  runtime.conditions.push({ id: "mark", name: "练习标记", stacks: 3, remaining: 2, anchor: "旅人", note: "" });
  assert.deepEqual(calculateCharacter(b), calculateCharacter(saved));
  assert.deepEqual(b, saved);
});
