import { contentPack } from "./content-pack.ts";
import {
  addEntry,
  catalog,
  getEntry,
  named,
  ownedItems,
  trainingCost,
} from "./catalog.ts";
import {
  buildIssues,
  calculateCharacter,
  defaultRules,
  emptyBuild,
  learningIssues,
} from "./rules.ts";
import type {
  Build,
  Character,
  Entry,
  InventoryItem,
  Rulings,
} from "./types.ts";

export const craftChoices = [
  "农事",
  "驭兽",
  "锻造",
  "成衣",
  "制宝",
  "医术",
  "烹饪",
  "毒术",
  "茶道",
  "酒艺",
  "书写",
  "作画",
  "演奏",
  "棋术",
  "表演",
  "道法",
  "佛法",
  "乞讨",
];
export type BackgroundGrant = {
  moves: string[];
  equipment: string[];
  quantities?: Record<string, number>;
  silver: number;
  previousWeapon: string;
  warnings: string[];
};
export function backgroundBenefits(id: string) {
  const entry = getEntry(id);
  const text = (entry?.text ?? "").replace(/\s+/g, "");
  const routineName = text.match(/武学[：:]你领悟《([^》]+)》/)?.[1];
  const routine = routineName
    ? (named(routineName, "routine") ?? named(routineName, "special"))
    : undefined;
  const bag = (text.match(/行囊[：:]([\s\S]+)/)?.[1] ?? "").split(
    /特性[：:]/,
  )[0];
  const silver = Number(bag.match(/(\d+)两白银/)?.[1] ?? 0);
  const equipment: Entry[] = [];
  const quantities: Record<string, number> = {};
  const unlisted: InventoryItem[] = [];
  const warnings: string[] = [];
  for (const raw of bag.split(/[、，,。]/)) {
    const name = raw.replace(/[*×]\d+$/, "");
    if (!name || /两白银/.test(name)) continue;
    const item = catalog.find(
      (e) =>
        e.kind === "equipment" &&
        e.name.replace(/[（(][^）)]+[）)]/g, "") === name,
    );
    const amount = Number(raw.match(/[*×](\d+)$/)?.[1] ?? 1);
    if (item) {
      equipment.push(item);
      quantities[item.id] = amount;
    } else if (name) {
      const gold = name.match(/^(\d+)两黄金$/);
      unlisted.push({
        id: `custom-background-${id}-${unlisted.length}`,
        name: gold ? "黄金" : name,
        quantity: gold ? Number(gold[1]) : amount,
        note: gold
          ? "单位：两；身世赠送，未折算为白银。"
          : `身世「${entry?.name}」赠送；效果以原书为准。`,
      });
      warnings.push(`背景行囊「${raw}」已作为自定义物品记入，请核对用途。`);
    }
  }
  if (routineName && !routine)
    warnings.push(`背景武学《${routineName}》尚需核对。`);
  const feature = text.split(/特性[：:]/)[1];
  if (entry?.name === "落魄纨绔" && feature)
    unlisted.push({
      id: `custom-background-${id}-deed`,
      name: "地契当票",
      quantity: 1,
      note: feature.slice(0, 500),
    });
  return { routine, equipment, silver, warnings, quantities, unlisted };
}
// Provenance only covers items this draft actually granted. Manually owned or upgraded entries are preserved.
export function changeDraftBackground(
  build: Build,
  id: string,
  previous?: BackgroundGrant,
) {
  let b = structuredClone(build);
  if (previous) {
    b.moves = b.moves.filter(
      (x) => !previous.moves.includes(x.id) || x.level > 1,
    );
    const inventory = ownedItems(b).flatMap((x) =>
      previous.equipment.includes(x.id)
        ? x.quantity > (previous.quantities?.[x.id] ?? 1)
          ? [
              {
                ...x,
                quantity: x.quantity - (previous.quantities?.[x.id] ?? 1),
              },
            ]
          : []
        : [x],
    );
    b.inventory = inventory;
    b.equipment = b.equipment.filter((x) =>
      inventory.some((item) => item.id === x),
    );
    b.silver = Math.max(0, b.silver - previous.silver);
    if (previous.equipment.includes(b.activeWeapon))
      b.activeWeapon = b.equipment.includes(previous.previousWeapon)
        ? previous.previousWeapon
        : "";
  }
  b.background = id;
  b.backgroundSkillChoice = "";
  const benefit = backgroundBenefits(id);
  const oldMoves = new Set(b.moves.map((x) => x.id));
  const oldItems = ownedItems(b);
  const previousWeapon = b.activeWeapon;
  if (benefit.routine)
    b = addEntry(b, benefit.routine, 1, { kind: "background", entryId: id });
  for (const e of benefit.equipment) {
    b = addEntry(b, e);
    b.inventory = ownedItems(b).map((x) =>
      x.id === e.id
        ? {
            ...x,
            quantity:
              (oldItems.find((old) => old.id === e.id)?.quantity ?? 0) +
              (benefit.quantities[e.id] ?? 1),
          }
        : x,
    );
  }
  const inventory = ownedItems(b);
  for (const item of benefit.unlisted) {
    const old = inventory.find((x) => x.id === item.id);
    if (old) old.quantity += item.quantity;
    else inventory.push(item);
  }
  b.inventory = inventory;
  b.silver += benefit.silver;
  const grant: BackgroundGrant = {
    moves: b.moves.filter((x) => !oldMoves.has(x.id)).map((x) => x.id),
    equipment: [
      ...benefit.equipment.map((x) => x.id),
      ...benefit.unlisted.map((x) => x.id),
    ],
    quantities: {
      ...benefit.quantities,
      ...Object.fromEntries(benefit.unlisted.map((x) => [x.id, x.quantity])),
    },
    silver: benefit.silver,
    previousWeapon,
    warnings: benefit.warnings,
  };
  return { build: b, grant };
}
export function createStarter(name = "") {
  const preset = contentPack.starter;
  const start = changeDraftBackground({ ...emptyBuild(), name }, preset.background);
  let b = { ...start.build, ...structuredClone(preset.build), name, rulesVersion: contentPack.rulesVersion };
  for (const item of preset.learn) {
    const entry = getEntry(item.id);
    if (entry) b = addEntry(b, entry, item.level, { kind: "starter", entryId: entry.id });
  }
  for (const id of preset.equipment) {
    const entry = getEntry(id);
    if (entry) b = addEntry(b, entry);
  }
  b.activeWeapon = preset.activeWeapon;
  b.favorites = [...preset.favorites];
  b.notes = preset.description;
  return { build: b, grant: structuredClone(preset.backgroundGrant ?? start.grant) };
}
export function saveBuildProblems(
  b: Build,
  old: Character | undefined,
  rules: Rulings = defaultRules,
  mode = "creation",
  dmOverride = false,
  isDm = false,
) {
  const out = buildIssues(b, rules);
  for (const mid of b.meridians) {
    const e = getEntry(mid);
    if (!e) out.push("经脉资料不存在。");
    else if (!dmOverride && !old?.build.meridians.includes(mid))
      out.push(...learningIssues(b, e, rules).map((s) => `${e.name}：${s}`));
  }
  for (const l of [...b.inner, ...b.moves]) {
    const prev =
      old &&
      [...old.build.inner, ...old.build.moves].find((x) => x.id === l.id);
    if (prev && prev.level >= l.level) continue;
    const e = getEntry(l.id);
    if (e && !dmOverride)
      out.push(
        ...learningIssues(old?.build ?? b, e, rules).map(
          (s) => `${e.name}：${s}`,
        ),
      );
  }
  if(old && !dmOverride && b.meridians.some(id=>!old.build.meridians.includes(id)))out.push("新增经脉请在角色卡的修炼与经脉中记录冲关或确认奇经。");
  if (old) {
    const cost = trainingCost(old.build, b, old.growth?.progress);
    if (mode === "training") {
      if (cost > old.build.xp)
        out.push(
          `丹田修为不足：需要 ${cost}，可用 ${old.build.xp}，还差 ${cost - old.build.xp}。`,
        );
      const daily = calculateCharacter(old.build).insight * 200;
      if (cost + (old.growth?.spent[old.growth.day] ?? 0) > daily && !dmOverride)
        out.push(`本日已投入 ${old.growth?.spent[old.growth.day] ?? 0}，加上本次 ${cost} 超过每日 ${daily}；请在修炼记录选择游戏内日期。`);
    } else if (!isDm && cost > 0)
      out.push("角色成长请选择「修炼并消耗修为」。");
  }
  return [...new Set(out)];
}
export function problemStep(message: string) {
  if (/姓名|基础值|悟性基值/.test(message)) return 0;
  if (/性格|身世|门派|技艺/.test(message)) return 1;
  if (/运行内功|学习内功/.test(message)) return 2;
  if (/装备|持握|武器|经脉|自由属性/.test(message)) return 4;
  const entry = catalog.find((e) => message.startsWith(e.name + "："));
  if (entry)
    return entry.kind === "inner" ? 2 : entry.kind === "meridian" ? 4 : 3;
  if (/武学招式/.test(message)) return 3;
  return 5;
}
export const stepHelp = [
  "先取一个名字。其余规则数值已有默认值，不需要手动计算。",
  "身世带来起始技能和物品；性格让两项技能各加2。门派决定优先挑选哪些功法。",
  "内功决定六项属性。只运行一门；修满后的永久收益，即使换内功也保留。",
  "武学是一套招式。新手先选一套本门人级武学，再看其中的攻击、防守和破防手段。",
  "先确认招式需要的武器，并选为持握。经脉属于后续成长，没有也能开局。",
  "先看上桌会用到的动作，再核对缺项。建立正式角色后，全团才能看到它。",
];
