import { z } from "zod";
import { portraitIdSchema, portraitsSchema } from "./portraits.ts";
const id = z.string().min(1).max(140);
const text = z.string().max(4000);
const value = z.number().int().min(0).max(1000000).nullable();
export const stageUnitSchema = z.object({
  portraitId: portraitIdSchema.optional(),
  id,
  name: z.string().trim().min(1).max(80),
  side: z.enum(["player", "ally", "enemy"]),
  characterId: z.string().max(140).default(""),
  moduleId: z.string().max(140).default(""),
  npcId: z.string().max(140).default(""),
  score: z.number().int().min(-10000).max(10000).nullable(),
  bonus: z.number().int().min(-1000).max(1000).nullable(),
  die: z.number().int().min(1).max(20).nullable(),
  out: z.boolean(),
  hidden: z.boolean(),
  publicName: z.string().max(80),
  screenDetails: z.boolean().optional(),
  activeTechnique: z.string().max(120).optional(),
  activeTechniqueEffect: z.string().max(1000).optional(),
  rage: z.number().int().min(0).max(10).nullable().optional(),
  shield: value.optional(),
  hp: value,
  hpMax: value,
  mp: value,
  mpMax: value,
  healthLabel: z.enum(["气血", "体力"]),
  conditions: z.string().max(1000),
  note: text,
  reserve: z.boolean().optional(),
  offstage: z.boolean().optional(),
  scriptActorId: id.optional(),
});
export const stageBoardSchema = z
  .object({
    trackingMode: z.enum(["round", "turn"]).optional(),
    title: z.string().trim().min(1).max(80),
    status: z.enum(["setup", "running", "paused", "ended"]),
    round: z.number().int().min(0).max(100000),
    activeId: id.nullable(),
    units: z.array(stageUnitSchema).max(60),
    scriptId: id.optional(),
    scriptVersion: z.string().max(80).optional(),
  })
  .superRefine((b, ctx) => {
    if (new Set(b.units.map((u) => u.id)).size !== b.units.length)
      ctx.addIssue({ code: "custom", message: "单位编号重复" });
    if (
      b.activeId &&
      !b.units.some(
        (u) => u.id === b.activeId && !u.out && !u.reserve && !u.offstage,
      )
    )
      ctx.addIssue({ code: "custom", message: "当前行动者不存在或已退场" });
    if (b.status === "running" && (!b.activeId || b.round < 1))
      ctx.addIssue({ code: "custom", message: "进行中的遭遇缺少行动者或轮数" });
  });
const moduleImage = z
  .string()
  .max(500)
  .refine(
    (v) => !v || /^\/modules\/[a-z0-9/_-]+\.(png|jpe?g|webp)$/i.test(v),
    "请选择本团模组中的图片",
  );
export const sceneSchema = z.object({
  id,
  title: z.string().trim().min(1).max(100),
  kind: z.enum(["scene", "clue"]),
  text: z.string().max(20000),
  dmNotes: z.string().max(16000),
  image: moduleImage,
  moduleId: z.string().max(140),
  sourcePage: z.number().int().min(1).max(10000).nullable(),
  archived: z.boolean(),
});
export const sessionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  date: z.string().max(30),
  outline: z.string().max(20000),
  notes: z.string().max(30000),
  recap: z.string().max(20000),
});
export const entityRefSchema = z.object({
  kind: z.enum(["rule", "npc", "scene", "encounter", "module", "character"]),
  id,
  moduleId: z.string().max(140).optional(),
  page: z.number().int().min(1).optional(),
});
export type EntityRef = z.infer<typeof entityRefSchema>;
export const journalSchema = z.object({
  id,
  sessionId: id,
  text: z.string().trim().min(1).max(12000),
  at: z.string().max(40),
  refs: z.array(entityRefSchema).max(30),
  unresolved: z.boolean(),
});
export const hostContextSchema = z.object({
  session: sessionSchema,
  sessions: z.array(sessionSchema.extend({ id })).optional(),
  activeSessionId: id.optional(),
  journal: z.array(journalSchema).optional(),
  pins: z.array(entityRefSchema).optional(),
});
export const hostingSchema = z.object({
  contextHistory: z
    .array(
      z.object({
        id,
        label: z.string(),
        at: z.string(),
        before: hostContextSchema,
        after: hostContextSchema,
      }),
    )
    .max(20)
    .optional(),
  sessions: z.array(sessionSchema.extend({ id })).max(300).optional(),
  activeSessionId: id.optional(),
  journal: z.array(journalSchema).max(2000).optional(),
  pins: z.array(entityRefSchema).max(30).optional(),
  tones: z
    .array(z.enum(["宫", "商", "角", "徵", "羽"]))
    .max(5)
    .optional(),
  toneHistory: z
    .array(z.array(z.enum(["宫", "商", "角", "徵", "羽"])).max(5))
    .max(30)
    .optional(),
  revision: z.number().int().min(0),
  session: sessionSchema,
  scenes: z.array(sceneSchema).max(100),
  activeSceneId: id.nullable(),
  board: stageBoardSchema,
  presets: z
    .array(
      z.object({
        id,
        name: z.string().trim().min(1).max(80),
        units: z.array(stageUnitSchema).max(60),
        sourceId: id.optional(),
        sourceVersion: z.string().max(80).optional(),
      }),
    )
    .max(200),
  archives: z
    .array(z.object({ id, at: z.string().max(40), board: stageBoardSchema }))
    .max(10),
  history: z
    .array(
      z.object({
        id,
        label: z.string().max(120),
        at: z.string().max(40),
        board: stageBoardSchema,
      }),
    )
    .max(20),
  screen: z.object({
    mode: z.enum(["standby", "initiative", "text", "image"]),
    title: z.string().max(100),
    text: z.string().max(20000),
    image: moduleImage,
    publishedAt: z.string().max(40),
    sceneId: z.string().max(140),
  }),
});
export type StageUnit = z.infer<typeof stageUnitSchema>;
export type StageBoard = z.infer<typeof stageBoardSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type HostSession = z.infer<typeof sessionSchema>;
export type HostingState = z.infer<typeof hostingSchema>;
export const hostOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("contextUndo") }),
  z.object({
    kind: z.literal("sessionNew"),
    title: z.string().trim().min(1).max(100),
    date: z.string().max(30),
  }),
  z.object({ kind: z.literal("sessionSelect"), id }),
  z.object({ kind: z.literal("journal"), value: journalSchema }),
  z.object({ kind: z.literal("pin"), value: entityRefSchema }),
  z.object({
    kind: z.literal("tone"),
    value: z.enum(["宫", "商", "角", "徵", "羽", "清空", "撤销"]),
  }),
  z.object({ kind: z.literal("session"), sessionId: id.optional(), value: sessionSchema }),
  z.object({ kind: z.literal("scene"), value: sceneSchema }),
  z.object({ kind: z.literal("activeScene"), id }),
  z.object({
    kind: z.literal("publish"),
    mode: z.enum(["standby", "initiative", "text", "image"]),
    sceneId: id.optional(),
  }),
  z.object({
    kind: z.literal("add"),
    units: z.array(stageUnitSchema).min(1).max(60),
    portraits: portraitsSchema.optional(),
  }),
  z.object({ kind: z.literal("edit"), unit: stageUnitSchema, portraits: portraitsSchema.optional() }),
  z.object({ kind: z.literal("move"), id, direction: z.enum(["up", "down"]) }),
  z.object({ kind: z.literal("out"), id, out: z.boolean() }),
  z.object({ kind: z.literal("remove"), id }),
  z.object({ kind: z.literal("autoRoll"), id, characterId: id.optional() }),
  z.object({ kind: z.literal("rollAll"), reroll: z.boolean().default(false) }),
  z.object({
    kind: z.literal("roll"),
    id,
    characterId: id,
    die: z.number().int().min(1).max(20),
  }),
  z.object({ kind: z.literal("sort") }),
  z.object({ kind: z.literal("start") }),
  z.object({ kind: z.literal("next") }),
  z.object({ kind: z.literal("nextRound") }),
  z.object({ kind: z.literal("setActive"), id }),
  z.object({ kind: z.literal("trackingMode"), mode: z.enum(["round", "turn"]) }),
  z.object({ kind: z.literal("pause") }),
  z.object({ kind: z.literal("resume") }),
  z.object({ kind: z.literal("end") }),
  z.object({ kind: z.literal("undo") }),
  z.object({ kind: z.literal("new"), title: z.string().trim().min(1).max(80) }),
  z.object({
    kind: z.literal("presetSave"),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({ kind: z.literal("presetLoad"), id }),
  z.object({
    kind: z.literal("scriptImport"),
    ids: z.array(id).min(1).max(100),
  }),
  z.object({
    kind: z.literal("scriptLoad"),
    id,
    counts: z.record(z.number().int().min(0).max(30).nullable()),
    characterIds: z.array(id).max(30),
  }),
  z.object({ kind: z.literal("enter"), id }),
  z.object({ kind: z.literal("scriptWave"), actorId: id }),
]);
export type HostOperation = z.infer<typeof hostOperationSchema>;
