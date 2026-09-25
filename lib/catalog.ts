import { contentPack } from "./content-pack.ts";
import type { Build, Entry, InventoryItem, LearningOrigin, Learned } from "./types.ts";
export const DATA_REVISION = contentPack.revision;
export const catalog: Entry[] = contentPack.catalog;
export const byId = new Map(catalog.map((e) => [e.id, e]));
export const getEntry = (id: string) => byId.get(id);
export const named = (name: string, kind?: string) =>
  catalog.find((e) => e.name === name && (!kind || e.kind === kind));
export const kindNames: Record<string, string> = {
  inner: "内功",
  routine: "武学套路",
  move: "招式",
  special: "散手",
  equipment: "装备与道具",
  background: "身世",
  personality: "性格",
  meridian: "经脉",
  status: "状态",
  skill: "技能与技艺",
  sect: "门派",
  reference: "原书页参考",
};
export const sourceLabel = (e: Entry) =>
  `${contentPack.sources[e.source.book]} · ${e.source.page ?? e.source.pdfPage} 页`;
export const ranks = ["", "领悟", "掌握", "精通", "合一"];
export const innerRanks = ["", "领悟", "小成", "圆满"];
export function maxRank(e: Entry): number {
  if (e.kind === "routine") {
    const children = catalog.filter((m) => m.parentId === e.id);
    if (children.length) return Math.max(...children.map(maxRank));
  }
  if (e.learning) return Math.max(...e.learning.stages.map((s) => s.level));
  if (e.music) return 3;
  return e.lightness
    ? 1
    : e.kind === "inner"
      ? Math.max(1, ...(e.stages ?? []).map((s) => s.stage))
      : e.grade === "天级"
        ? 4
        : 3;
}
export const rankLabel = (e: Entry, level: number) =>
  e.learning?.stages.find((s) => s.level === level)?.name ??
  (e.kind === "inner" ? innerRanks[level] : ranks[level]);
export function xpCost(e: Entry, level: number) {
  if (e.grantedBy) return 0;
  if (e.learning)
    return e.learning.stages.find((s) => s.level === level)?.cost ?? 0;
  if (e.costs) return e.costs[level - 1] ?? 0;
  if (e.music && e.kind === "special") return e.music.learnCost;
  const g = e.grade;
  if (e.lightness) return g === "天级" ? 6000 : g === "地级" ? 3000 : 1000;
  return e.kind === "inner"
    ? ({
        人级: [0, 1000, 3000],
        地级: [1000, 4000, 10000],
        天级: [2000, 12000, 30000],
      }[g]?.[level - 1] ?? 0)
    : ({
        人级: [0, 500, 1000],
        地级: [500, 1500, 3000],
        天级: [1000, 3000, 6000, 10000],
      }[g]?.[level - 1] ?? 0);
}
/** Derived child effects never become extra learning records or extra skill growth. */
export function effectiveMoves(build: Build): Learned[] {
  const result = new Map(build.moves.map(l => [l.id, l]));
  for (const e of catalog) if (e.grantedBy) {
    const parent = build.moves.find(l => l.id === e.grantedBy);
    if (parent) result.set(e.id, { id: e.id, level: Math.min(parent.level, maxRank(e)), origin: { kind: "individual", entryId: parent.id } });
  }
  return [...result.values()];
}
export function invested(build: Build) {
  return [...build.inner, ...build.moves].reduce(
    (n, l) => n + (getEntry(l.id) ? xpCost(getEntry(l.id)!, l.level) : 0),
    0,
  );
}
export function trainingCost(
  before: Build,
  after: Build,
  progress: Record<string, number> = {},
) {
  return [...after.inner, ...after.moves].reduce((total, item) => {
    const e = getEntry(item.id);
    const old = [...before.inner, ...before.moves].find(
      (x) => x.id === item.id,
    );
    return (
      total +
      (e
        ? Math.max(
            0,
            xpCost(e, item.level) -
              Math.max(progress[item.id] ?? 0, old ? xpCost(e, old.level) : 0),
          )
        : 0)
    );
  }, 0);
}
export function addEntry(
  build: Build,
  entry: Entry,
  level = 1,
  origin?: LearningOrigin,
): Build {
  const b = structuredClone(build);
  const learn = (id: string, target: "inner" | "moves", rank: number) => {
    const a = b[target].find((x) => x.id === id);
    if (a) a.level = Math.max(a.level, rank);
    else
      b[target].push({
        id,
        level: rank,
        origin: origin ?? {
          kind: entry.kind === "routine" ? "routine" : "individual",
          entryId: entry.id,
        },
      });
  };
  if (entry.kind === "inner") {
    learn(entry.id, "inner", level);
    if (!b.activeInner) b.activeInner = entry.id;
  }
  if (entry.kind === "routine")
    catalog
      .filter((e) => e.parentId === entry.id)
      .forEach((e) => learn(e.id, "moves", Math.min(level, maxRank(e))));
  if (entry.kind === "move" || entry.kind === "special")
    learn(entry.id, "moves", entry.music ? 3 : level);
  if (entry.kind === "equipment" && !b.equipment.includes(entry.id)) {
    b.inventory = ownedItems(b);
    if (!b.inventory.some((x) => x.id === entry.id))
      b.inventory.push({ id: entry.id, quantity: 1 });
    if (!isConsumable(entry)) {
      b.equipment.push(entry.id);
      if (entry.slot === "武器") b.activeWeapon = entry.id;
    }
  }
  if (entry.kind === "meridian" && !b.meridians.includes(entry.id))
    b.meridians.push(entry.id);
  if (entry.kind === "background") b.background = entry.id;
  if (entry.kind === "personality" && b.personality !== entry.id) {
    b.personality = entry.id;
    b.personalityChoices = [];
  }
  if (entry.kind === "sect") b.sect = entry.name;
  return b;
}
export const weapons = [
  "徒手",
  "剑",
  "刀",
  "棍",
  "匕首",
  "暗器",
  "乐器",
  "奇门",
];
export const weaponOf = (e?: Entry) =>
  e?.weapon ||
  weapons.find((w) => (e?.requirement ?? "").split("属性")[0].startsWith(w)) ||
  "";

// Older cards stored possessions only in equipment. Preserve them on first edit.
export function ownedItems(b: Build): InventoryItem[] {
  return structuredClone(
    b.inventory ?? [...new Set(b.equipment)].map((id) => ({ id, quantity: 1 })),
  );
}
export const inventoryName = (item: InventoryItem) =>
  getEntry(item.id)?.name ?? item.name ?? "未命名物品";
export function isConsumable(e: Entry) {
  if (e.slot && !["行囊"].includes(e.slot)) return false;
  return /服用|饮用|食用|涂抹|药丸|药粉|药膏|药酒|汤药|毒药|丹药|药散/.test(
    e.text,
  );
}
export function inventoryCategory(e?: Entry) {
  if (!e) return "自定义物品";
  if (e.slot === "武器") return "武器";
  if (
    ["上衣", "下衣", "头饰", "鞋子", "戒指", "耳环", "项链", "饰品"].includes(
      e.slot ?? "",
    )
  )
    return "防具与饰物";
  return isConsumable(e) ? "药物与消耗品" : "工具与其他道具";
}
export function addPossession(b: Build, e: Entry, quantity = 1): Build {
  const inventory = ownedItems(b);
  const item = inventory.find((x) => x.id === e.id);
  if (item) item.quantity = Math.min(100000, item.quantity + quantity);
  else inventory.push({ id: e.id, quantity });
  return { ...b, inventory };
}
export function equipPossession(b: Build, id: string): Build {
  const e = getEntry(id);
  if (!e || isConsumable(e) || !ownedItems(b).some((x) => x.id === id))
    return b;
  const inventory = ownedItems(b);
  const others = b.equipment.filter((x) => x !== id);
  const slot = e.slot || "行囊";
  const limit =
    slot === "戒指" ? 2 : slot === "饰品" ? 6 : slot === "行囊" ? Infinity : 1;
  const same = others.filter((x) => (getEntry(x)?.slot || "行囊") === slot);
  const replaced = new Set(same.slice(0, Math.max(0, same.length - limit + 1)));
  return {
    ...b,
    inventory,
    equipment: [...others.filter((x) => !replaced.has(x)), id],
    activeWeapon: e.slot === "武器" ? id : b.activeWeapon,
  };
}
export function inventoryIssues(b: Build): string[] {
  const items = ownedItems(b);
  const ids = items.map((x) => x.id);
  const errors: string[] = [];
  if (new Set(ids).size !== ids.length)
    errors.push("行囊中有重复物品，请合并数量。");
  for (const item of items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100000
    )
      errors.push("物品数量必须是 1 至 100000 的整数。");
    if (
      getEntry(item.id)?.kind !== "equipment" &&
      !(item.id.startsWith("custom-") && item.name?.trim())
    )
      errors.push("行囊中有无法识别的物品。");
  }
  for (const id of b.equipment)
    if (!ids.includes(id))
      errors.push(
        `已装备的${getEntry(id)?.name ?? "物品"}必须保留在行囊中，请先卸下。`,
      );
  return errors;
}
