import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, emptyCampaign } from "../lib/campaign.ts";
import { createStarter } from "../lib/onboarding.ts";
import {
  emptyRuntime,
  calculateCharacter,
  calculateMove,
} from "../lib/rules.ts";
import { named, addEntry, addPossession } from "../lib/catalog.ts";
import { campaignSchema, commandSchema } from "../lib/validation.ts";
import type { Campaign } from "../lib/types.ts";
import {
  buildResourceChanges,
  applyTableOperation,
  resourceChange,
  skillReference,
} from "../lib/tabletop.ts";
const start = () => {
  const c = emptyCampaign();
  const build = createStarter("桌边验收").build;
  c.characters = [
    { id: "hero", revision: 1, build, runtime: emptyRuntime(build) },
  ];
  return c;
};
const edit = (
  c: Campaign,
  operation: unknown,
  revision = c.characters[0].revision,
  acknowledged = false,
) =>
  applyCommand(
    c,
    commandSchema.parse({
      requestId: crypto.randomUUID(),
      expectedVersion: 0,
      role: "player",
      by: "桌边验收",
      type: "tableEdit",
      payload: { id: "hero", revision, operation, acknowledged },
    }),
  );
test("player updates one resource without modifying other resources, build or legacy action flags", () => {
  const c = start();
  c.characters[0].runtime.rage = 6;
  c.characters[0].runtime.main = false;
  const before = structuredClone(c.characters[0]);
  const next = edit(c, {
    kind: "resource",
    field: "hp",
    mode: "subtract",
    value: 18,
  });
  assert.equal(next.characters[0].runtime.hp, before.runtime.hp - 18);
  assert.equal(next.characters[0].runtime.mp, before.runtime.mp);
  assert.deepEqual(next.characters[0].build, before.build);
  assert.equal(next.characters[0].runtime.rage, 6);
  assert.equal(next.characters[0].runtime.main, false);
  assert.equal(next.logs[0].table, true);
  assert.equal(c.characters[0].runtime.hp, before.runtime.hp);
  assert.throws(
    () =>
      edit(
        next,
        { kind: "resource", field: "mp", mode: "subtract", value: 2 },
        1,
      ),
    /新记录/,
  );
});
