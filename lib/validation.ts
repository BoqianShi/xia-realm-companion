import { growthSchema } from "./growth.ts";
import { z } from "zod";
import { portraitIdSchema, portraitsSchema } from "./portraits.ts";
import { hostingSchema } from "./hosting-schema.ts";
import { RULES_VERSION } from "./types.ts";
const id = z.string().min(1).max(140);
const num = z.number().finite();
const nonnegative = num.int().min(0).max(10000000);
export const inventorySchema = z
  .array(
    z.object({
      id,
      quantity: num.int().min(1).max(100000),
      name: z.string().trim().min(1).max(80).optional(),
      note: z.string().max(500).optional(),
    }),
  )
  .max(500);
export const statsSchema = z.object({
  strength: nonnegative,
  agility: nonnegative,
  body: nonnegative,
  breath: nonnegative,
  qi: nonnegative,
  spirit: nonnegative,
});
const learningOriginSchema = z.object({
  kind: z.enum(["background", "starter", "routine", "individual"]),
  entryId: id,
});
export const buildSchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["pc", "npc"]),
  sect: z.string().max(60),
  background: z.string().max(140),
  backgroundSkillChoice: z.string().max(30).optional(),
  personality: z.string().max(140),
  personalityChoices: z.array(z.string().max(20)).max(2),
  freeAttributes: statsSchema,
  base: statsSchema,
  insightBase: nonnegative,
  skillChoices: z.record(z.string().max(30), nonnegative),
  inner: z
    .array(
      z.object({
        id,
        level: z.number().int().min(1).max(3),
        origin: learningOriginSchema.optional(),
      }),
    )
    .max(300),
  activeInner: z.string().max(140),
  moves: z
    .array(
      z.object({
        id,
        level: z.number().int().min(1).max(4),
        origin: learningOriginSchema.optional(),
      }),
    )
    .max(2400),
  equipment: z.array(id).max(100),
  inventory: inventorySchema.optional(),
  activeWeapon: z.string().max(140),
  meridians: z.array(id).max(40),
  traits: z.array(id).max(100),
  bonuses: z
    .array(
      z.object({
        key: z.string().max(50),
        value: num.min(-100000).max(100000),
        label: z.string().min(1).max(140),
      }),
    )
    .max(150),
  xp: nonnegative,
  silver: nonnegative,
  notes: z.string().max(12000),
  favorites: z.array(id).max(200),
  rulesVersion: z.literal(RULES_VERSION),
});
export const conditionSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  stacks: z.number().int().min(1).max(1000),
  remaining: z.number().int().min(1).max(1000).nullable(),
  anchor: z.string().max(140),
  note: z.string().max(1000),
  effect: z.string().max(1000).optional(),
});
export const runtimeSchema = z.object({
  hp: nonnegative,
  mp: nonnegative,
  rage: z.number().int().min(0).max(10),
  shield: nonnegative,
  stance: z.string().max(140),
  conditions: z.array(conditionSchema).max(100),
  history: z.record(z.boolean()),
  main: z.boolean(),
  minor: z.boolean(),
  reaction: z.boolean(),
  usedRoutine: z.string().max(140),
});
export const tableSchema = z.object({
  counters: z
    .array(
      z.object({
        id,
        name: z.string().trim().min(1).max(40),
        value: num.int().min(0).max(100000),
        note: z.string().max(500),
        effect: z.string().max(1000).optional(),
      }),
    )
    .max(50),
  pinnedSkills: z.array(z.string().max(40)).max(50),
  notes: z
    .array(
      z.object({
        id,
        text: z.string().trim().min(1).max(4000),
        at: z.string().max(40),
      }),
    )
    .max(500),
});
export const tableOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("resource"),
    field: z.enum(["hp", "mp", "rage", "shield", "silver"]),
    mode: z.enum(["add", "subtract", "set"]),
    value: nonnegative,
  }),
  z.object({ kind: z.literal("stance"), value: z.string().max(140) }),
  z.object({ kind: z.literal("condition"), value: conditionSchema }),
  z.object({ kind: z.literal("removeCondition"), id }),
  z.object({
    kind: z.literal("counter"),
    value: tableSchema.shape.counters.element,
  }),
  z.object({ kind: z.literal("removeCounter"), id }),
  z.object({ kind: z.literal("pinSkill"), name: z.string().max(40) }),
  z.object({ kind: z.literal("pinMove"), id }),
  z.object({ kind: z.literal("pinArt"), id }),
  z.object({
    kind: z.literal("note"),
    text: z.string().trim().min(1).max(4000),
  }),
  z.object({
    kind: z.literal("item"),
    id,
    delta: num.int().min(-100000).max(100000),
  }),
  z.object({
    kind: z.literal("loadout"),
    field: z.enum(["activeInner", "activeWeapon"]),
    value: z.string().max(140),
  }),
]);
export const tableCommandSchema = z.object({
  id,
  revision: nonnegative,
  operation: tableOperationSchema,
  acknowledged: z.boolean().default(false),
});
export const characterSchema = z.object({
  portraitId: portraitIdSchema.optional(),
  growth: growthSchema.optional(),
  dataRevision: z.string().max(80).optional(),
  id,
  build: buildSchema,
  runtime: runtimeSchema,
  revision: nonnegative,
  table: tableSchema.optional(),
});
export const rulesSchema = z.object({
  rounding: z.enum(["unset", "total", "terms"]),
  fixedDamage: z.enum(["unset", "fixed", "bonuses"]),
  weaponSkill: z.enum(["tier", "progressive"]),
  allowExpansion: z.boolean(),
  allowedIds: z.array(id).max(6000),
  blockedIds: z.array(id).max(6000),
});
export const actionSchema = z.object({
  actorId: id,
  moveId: id,
  targets: z.array(id).max(100),
  kind: z.enum(["main", "reaction"]),
  hit: z.boolean(),
  critical: z.boolean(),
  breakStance: z.boolean(),
  huajin: z.number().int().min(0).max(10),
  yinjing: z.number().int().min(0).max(100),
  extraDamage: num.min(-100000).max(100000),
  distance: nonnegative,
  attackRoll: z.number().int().min(1).max(20).nullable(),
  manualNote: z.string().max(4000),
  manualHp: z.record(id, nonnegative),
  manualMp: z.record(id, nonnegative),
  manualShield: z.record(id, nonnegative),
  feintRoll: z.number().int().min(1).max(20).nullable(),
  seeThroughRoll: z.number().int().min(1).max(20).nullable(),
  interrupted: z.boolean(),
  ignoreRoutine: z.boolean(),
});
export const commandSchema = z.object({
  requestId: id,
  expectedVersion: nonnegative,
  role: z.enum(["player", "dm"]),
  by: z.string().min(1).max(80),
  type: z.enum([
    "grow",
    "host",
    "hostRoll",
    "importModules",
    "saveModule",
    "tableEdit",
    "savePortrait",
    "tableUndo",
    "saveBuild",
    "saveInventory",
    "saveSnapshot",
    "deleteSnapshot",
    "submitAction",
    "confirmAction",
    "rejectAction",
    "setRuntime",
    "switchInner",
    "rules",
    "encounter",
    "nextTurn",
    "undo",
    "restore",
  ]),
  payload: z.unknown(),
});
export type Command = z.infer<typeof commandSchema>;
export const snapshotSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  characterId: z.string().max(140),
  build: buildSchema,
  createdAt: z.string().max(40),
});
const encounterSchema = z.object({
  active: z.boolean(),
  round: nonnegative,
  turn: nonnegative,
  order: z.array(id).max(100),
});
const pendingSchema = z.object({
  id,
  input: actionSchema,
  actorRevision: nonnegative,
  targetRevisions: z.record(nonnegative),
  submittedBy: z.string().max(80),
  createdAt: z.string().max(40),
});
export const moduleNotebookSchema = z.object({
  id,
  sourceVersion: id,
  revision: nonnegative,
  importedAt: z.string().max(40),
  updatedAt: z.string().max(40),
  notes: z.string().max(30000),
  completed: z.array(id).max(300),
  bookmark: z.number().int().min(1).max(10000),
});
export const campaignSchema = z.object({
  portraits: portraitsSchema.optional(),
  hosting: hostingSchema.optional(),
  modules: z.array(moduleNotebookSchema).max(100).default([]),
  name: z.string().min(1).max(80),
  rules: rulesSchema,
  characters: z.array(characterSchema).max(100),
  snapshots: z.array(snapshotSchema).max(200),
  pending: z.array(pendingSchema).max(200),
  encounter: encounterSchema,
  logs: z
    .array(
      z.object({
        id,
        label: z.string().max(200),
        by: z.string().max(80),
        at: z.string().max(40),
        details: z.array(z.string().max(10000)).max(300),
        before: z.record(characterSchema),
        afterRevisions: z.record(nonnegative),
        encounterBefore: encounterSchema.optional(),
        encounterAfter: encounterSchema.optional(),
        undone: z.boolean(),
        table: z.boolean().optional(),
        moduleBefore: z.record(moduleNotebookSchema.nullable()).optional(),
        moduleAfterRevisions: z.record(nonnegative).optional(),
      }),
    )
    .max(500),
  receipts: z.record(z.object({ at: z.string(), result: z.string() })),
});
