import { contentPack } from "./content-pack.ts";
export const STAT_KEYS = [
  "strength",
  "agility",
  "body",
  "breath",
  "qi",
  "spirit",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export const STAT_NAMES: Record<StatKey, string> = {
  strength: "力量",
  agility: "身法",
  body: "体魄",
  breath: "内息",
  qi: "气感",
  spirit: "神采",
};
export type Source = {
  book: "core" | "expansion";
  version: string;
  page: number | null;
  pdfPage: number;
};
export type Entry = {
  grantedBy?: string;
  id: string;
  kind:
    | "inner"
    | "routine"
    | "move"
    | "special"
    | "equipment"
    | "background"
    | "personality"
    | "meridian"
    | "status"
    | "skill"
    | "sect"
    | "reference";
  name: string;
  grade: string;
  sect: string;
  text: string;
  source: Source;
  affinity?: string;
  requirement?: string;
  moveType?: string;
  distance?: string;
  costText?: string;
  insight?: number;
  stages?: { stage: number; stats: Stats }[];
  permanent?: string;
  effects?: Record<string, string>;
  upgrade?: string;
  parentId?: string;
  routine?: string;
  slot?: string;
  weapon?: string;
  modifiers?: Modifier[];
  skillBonuses?: Record<string, number>;
  choices?: string[];
  automation?: string;
  costs?: number[];
  freePoints?: number;
  lightness?: boolean;
  fullAction?: boolean;
  activeModifiers?: Record<string, EffectModifier[]>;
  unresolvedStatic?: Record<string, string[]>;
  effectModifiers?: EffectModifier[];
  unresolvedEffects?: string[];
  permanentUnresolved?: string[];
  weaponBonus?: Record<string, number>;
  subtype?: string;
  weaponDamage?: number;
  weaponBlock?: number;
  formula?: Formula;
  music?: {
    bookId: string;
    moveId: string;
    learnCost: number;
    difficulty: number;
    sequence: string;
    bonus: string;
    bookGrade: string;
    baseEffect: string;
  };
  relatedIds?: string[];
  learnable?: boolean;
  dataRevision?: string;
  review?: { structure: string; note: string };
  sourceSpan?: { startLine: number; endLine: number; book: string };
  learning?: { mode: "bespoke" | "read" | "once"; stages: { level: number; name: string; cost: number }[] };
};
export type Formula = {
  terms: DamageTerm[];
  fixed: number | null;
  damageType: MoveResult["damageType"];
  damageUpgrade: number;
  mp: number;
  mpUpgrade: number;
  rage: number;
  rageUpgrade: number;
  block: number;
  blockUpgrade: number;
  distance: number;
  distanceUpgrade: number;
  action: MoveResult["action"];
};
export type EffectModifier = Modifier & {
  when?: {
    affinity?: string[];
    weapon?: string;
    damageType?: string;
    innerAffinity?: string;
    noStance?: boolean;
    rankAtLeast?: number;
    condition?: string;
  };
  perStack?: string;
  perSkill?: string;
  perName?: boolean;
  sourceText?: string;
};
export type Modifier = { key: string; value: number; label: string };
export type LearningOrigin = {
  kind: "background" | "starter" | "routine" | "individual";
  entryId: string;
};
export type Learned = { id: string; level: number; origin?: LearningOrigin };
export type InventoryItem = {
  id: string;
  quantity: number;
  name?: string;
  note?: string;
};
export type Build = {
  name: string;
  kind: "pc" | "npc";
  sect: string;
  background: string;
  backgroundSkillChoice?: string;
  personality: string;
  personalityChoices: string[];
  freeAttributes: Stats;
  base: Stats;
  insightBase: number;
  skillChoices: Record<string, number>;
  inner: Learned[];
  activeInner: string;
  moves: Learned[];
  equipment: string[];
  inventory?: InventoryItem[];
  activeWeapon: string;
  meridians: string[];
  traits: string[];
  bonuses: Modifier[];
  xp: number;
  silver: number;
  notes: string;
  favorites: string[]; // Art IDs; legacy move IDs are resolved to their art when displayed.
  rulesVersion: string;
};
export type Condition = {
  id: string;
  name: string;
  stacks: number;
  remaining: number | null;
  anchor: string;
  note: string;
  effect?: string;
};
export type Runtime = {
  hp: number;
  mp: number;
  rage: number;
  shield: number;
  stance: string;
  conditions: Condition[];
  history: Record<string, boolean>;
  main: boolean;
  minor: boolean;
  reaction: boolean;
  usedRoutine: string;
};
export type Character = {
  portraitId?: string;
  growth?: import("./growth").Growth;
  dataRevision?: string;
  id: string;
  build: Build;
  runtime: Runtime;
  revision: number;
  table?: {
    counters: { id: string; name: string; value: number; note: string; effect?: string }[];
    pinnedSkills: string[];
    notes: { id: string; text: string; at: string }[];
  };
};
export type Snapshot = {
  id: string;
  name: string;
  characterId: string;
  build: Build;
  createdAt: string;
};
export type Rulings = {
  rounding: "unset" | "total" | "terms";
  fixedDamage: "unset" | "fixed" | "bonuses";
  weaponSkill: "tier" | "progressive";
  allowExpansion: boolean;
  allowedIds: string[];
  blockedIds: string[];
};
export type Encounter = {
  active: boolean;
  round: number;
  turn: number;
  order: string[];
};
export type ActionInput = {
  actorId: string;
  moveId: string;
  targets: string[];
  kind: "main" | "reaction";
  hit: boolean;
  critical: boolean;
  breakStance: boolean;
  huajin: number;
  yinjing: number;
  extraDamage: number;
  distance: number;
  attackRoll: number | null;
  manualNote: string;
  manualHp: Record<string, number>;
  manualMp: Record<string, number>;
  manualShield: Record<string, number>;
  feintRoll: number | null;
  seeThroughRoll: number | null;
  interrupted: boolean;
  ignoreRoutine: boolean;
};
export type Pending = {
  id: string;
  input: ActionInput;
  actorRevision: number;
  targetRevisions: Record<string, number>;
  submittedBy: string;
  createdAt: string;
};
export type Log = {
  id: string;
  label: string;
  by: string;
  at: string;
  details: string[];
  before: Record<string, Character>;
  afterRevisions: Record<string, number>;
  encounterBefore?: Encounter;
  encounterAfter?: Encounter;
  undone: boolean;
  table?: boolean;
  moduleBefore?: Record<string, import("./module-types").ModuleNotebook | null>;
  moduleAfterRevisions?: Record<string, number>;
};
export type Campaign = {
  portraits?: Record<string, string>;
  hosting?: import("./hosting-schema").HostingState;
  modules?: import("./module-types").ModuleNotebook[];
  name: string;
  rules: Rulings;
  characters: Character[];
  snapshots: Snapshot[];
  pending: Pending[];
  encounter: Encounter;
  logs: Log[];
  receipts: Record<string, { at: string; result: string }>;
};
export type Envelope = { version: number; campaign: Campaign };
export type CharacterResult = {
  stats: Stats;
  insight: number;
  realm: number;
  skills: Record<string, number>;
  weaponSkills: Record<string, number>;
  hpMax: number;
  mpMax: number;
  speed: number;
  dodge: number;
  initiative: number;
  physicalDefense: number;
  internalDefense: number;
  physicalHit: number;
  internalHit: number;
  physicalCrit: number;
  internalCrit: number;
  lookThrough: number;
  weaponDamage: number;
  weaponBlock: number;
  block: number;
  affinity: string;
  flatDamage: number;
  coefficientBonus: number;
  details: Modifier[];
  warnings: string[];
};
export type DamageTerm = { stat: StatKey; coefficient: number };
export type MoveResult = {
  id: string;
  name: string;
  type: string;
  weapon: string;
  damageType:
    | "physical"
    | "internal"
    | "poison"
    | "bleed"
    | "fire"
    | "mental"
    | "none";
  damage: number | null;
  critical: number | null;
  mpCost: number | null;
  rageCost: number;
  block: number;
  distance: number;
  action: "main" | "minor" | "simple" | "charge" | "reaction";
  terms: DamageTerm[];
  details: { label: string; value: number | string }[];
  warnings: string[];
  effects: string[];
  rank: number;
};
export type TargetResult = {
  id: string;
  hit: boolean;
  critical: boolean;
  broken: boolean;
  hpDamage: number;
  shieldDamage: number;
  mpLoss: number;
  hpLoss: number;
  ordinary: number;
  poison: number;
  details: string[];
  warnings: string[];
};
export type ActionResult = {
  move: MoveResult;
  targets: TargetResult[];
  actorMp: number;
  actorRage: number;
  actorHpLoss: number;
  actorMpGain: number;
  actorRageGain: number;
  details: string[];
  warnings: string[];
  errors: string[];
};
export const RULES_VERSION = contentPack.rulesVersion;
