import { weaponRequirement } from "./move-semantics.ts";
import { toggleFavoriteArt } from "./move-favorites.ts";
import type { Build, Character } from "./types.ts";
import type { z } from "zod";
import { tableOperationSchema } from "./validation.ts";
import { activeEffect, calculateCharacter } from "./rules.ts";
import {
  equipPossession,
  getEntry,
  effectiveMoves,
  inventoryIssues,
  inventoryName,
  ownedItems,
} from "./catalog.ts";
export type TableOperation = z.infer<typeof tableOperationSchema>;
export const tableData = (ch: Character) =>
  ch.table ?? { counters: [], pinnedSkills: [], notes: [] };
export const resourceNames = {
  hp: "气血",
  mp: "内力",
  rage: "怒气",
  shield: "护体",
  silver: "白银",
};
export function resourceChange(
  ch: Character,
  op: Extract<TableOperation, { kind: "resource" }>,
) {
  const c = calculateCharacter(ch.build);
  const before = op.field === "silver" ? ch.build.silver : ch.runtime[op.field];
  const max =
    op.field === "hp"
      ? c.hpMax
      : op.field === "mp"
        ? c.mpMax
        : op.field === "rage"
          ? 10
          : 10000000;
  const raw =
    op.mode === "set"
      ? op.value
      : before + (op.mode === "add" ? op.value : -op.value);
  return {
    before,
    after: Math.max(0, Math.min(max, raw)),
    max,
    clamped: raw < 0 || raw > max,
  };
}
export function loadoutBuild(
  ch: Character,
  field: "activeInner" | "activeWeapon",
  value: string,
) {
  if (field === "activeInner") {
    if (value && !ch.build.inner.some((x) => x.id === value))
      throw Error("只能运行已学内功。");
    return { ...ch.build, activeInner: value };
  }
  if (!value) return { ...ch.build, activeWeapon: "" };
  const e = getEntry(value);
  if (
    e?.slot !== "武器" ||
    !ownedItems(ch.build).some((x) => x.id === value && x.quantity > 0)
  )
    throw Error("只能持握行囊中已有的武器。");
  const b = equipPossession(ch.build, value);
  const errors = inventoryIssues(b);
  if (errors.length) throw Error(errors.join("；"));
  return b;
}
export function buildResourceChanges(ch: Character, next: Build) {
  const c = calculateCharacter(next);
  const changes: string[] = [];
  if (ch.runtime.hp > c.hpMax)
    changes.push(`气血 ${ch.runtime.hp} → ${c.hpMax}（新上限）`);
  if (ch.runtime.mp > c.mpMax)
    changes.push(`内力 ${ch.runtime.mp} → ${c.mpMax}（新上限）`);
  if (
    ch.runtime.stance &&
    (next.activeWeapon !== ch.build.activeWeapon ||
      !effectiveMoves(next).some((m) => m.id === ch.runtime.stance))
  )
    changes.push("当前架招将解除");
  return changes;
}
export function applyTableOperation(
  ch: Character,
  op: TableOperation,
  at: string,
  noteId: string,
) {
  const x = structuredClone(ch);
  const data = tableData(x);
  x.table = data;
  let details: string[] = [];
  if (op.kind === "resource") {
    const r = resourceChange(x, op);
    if (op.field === "silver") x.build.silver = r.after;
    else x.runtime[op.field] = r.after;
    details = [
      `${resourceNames[op.field]} ${r.before} → ${r.after}${r.clamped ? "（限制在允许范围内）" : ""}`,
    ];
  }
  if (op.kind === "stance") {
    if (
      op.value &&
      (!effectiveMoves(x.build).some((m) => m.id === op.value) ||
        getEntry(op.value)?.moveType !== "架招")
    )
      throw Error("只能记录已学习的架招。");
    if (op.value) { const issue=weaponRequirement(getEntry(op.value)!,getEntry(x.build.activeWeapon));if(issue)throw Error(issue); }
    x.runtime.stance = op.value;
    details = [`架招：${getEntry(op.value)?.name ?? "未开启"}；未扣除内力`];
  }
  if (op.kind === "condition") {
    x.runtime.conditions = [
      ...x.runtime.conditions.filter((s) => s.id !== op.value.id),
      op.value,
    ];
    if (x.runtime.conditions.length > 100) throw Error("状态数量达到上限。");
    details = [
      `${op.value.name} ×${op.value.stacks} · ${op.value.remaining === null ? "持续至手动移除" : op.value.remaining + " 回合（手动记录）"}`,
    ];
  }
  if (op.kind === "removeCondition") {
    x.runtime.conditions = x.runtime.conditions.filter((s) => s.id !== op.id);
    details = ["移除状态提醒"];
  }
  if (op.kind === "counter") {
    data.counters = [
      ...data.counters.filter((s) => s.id !== op.value.id),
      op.value,
    ];
    if (data.counters.length > 50) throw Error("计数器数量达到上限。");
    details = [`${op.value.name}：${op.value.value}`];
  }
  if (op.kind === "removeCounter") {
    data.counters = data.counters.filter((s) => s.id !== op.id);
    details = ["移除计数器"];
  }
  if (op.kind === "pinSkill") {
    if (getEntry("skill-" + op.name)?.kind !== "skill")
      throw Error("技能不存在。");
    data.pinnedSkills = data.pinnedSkills.includes(op.name)
      ? data.pinnedSkills.filter((n) => n !== op.name)
      : [...data.pinnedSkills, op.name];
    details = [`常用技能：${op.name}`];
  }
  if (op.kind === "pinArt" || op.kind === "pinMove") {
    x.build.favorites = toggleFavoriteArt(x.build, op.id);
    details = ["调整常用武学 · " + (getEntry(op.id)?.name ?? op.id)];
  }
  if (op.kind === "note") {
    if (data.notes.length >= 500) throw Error("笔记已达上限，请先导出整理。");
    data.notes = [{ id: noteId, text: op.text, at }, ...data.notes];
    details = ["追加桌边笔记"];
  }
  if (op.kind === "item") {
    const items = ownedItems(x.build);
    const item = items.find((i) => i.id === op.id);
    if (!item) throw Error("行囊中没有这件物品。");
    const before = item.quantity;
    const qty = before + op.delta;
    if (qty < 0 || qty > 100000) throw Error("物品数量不能为负或超过上限。");
    if (qty === 0 && x.build.equipment.includes(op.id))
      throw Error("已装备的物品需先卸下。");
    item.quantity = qty;
    x.build.inventory = items.filter((i) => i.quantity > 0);
    details = [`${inventoryName(item)}：${before} → ${qty}；效果请现场处理`];
  }
  if (op.kind === "loadout") {
    const b = loadoutBuild(x, op.field, op.value);
    details = [
      `${op.field === "activeInner" ? "运行内功" : "持握武器"}：${getEntry(op.value)?.name ?? (op.field === "activeInner" ? "未运行" : "徒手")}`,
      ...buildResourceChanges(x, b),
    ];
    const calc = calculateCharacter(b);
    x.runtime.hp = Math.min(x.runtime.hp, calc.hpMax);
    x.runtime.mp = Math.min(x.runtime.mp, calc.mpMax);
    if (b.activeWeapon !== x.build.activeWeapon) x.runtime.stance = "";
    x.build = b;
  }
  return { character: x, details };
}
export function skillReference(ch: Character, name: string) {
  return skillCheck(ch.build, name);
}
export function skillCheck(build: Build, name: string) {
  const c = calculateCharacter(build);
  const e = getEntry("skill-" + name);
  const level = c.skills[name] ?? 0;
  let value = level;
  const conditional: string[] = [];
  for (const m of c.details.filter((m) => m.key === "check:" + name)) {
    value += m.value;
    conditional.push(
      `已计入${m.value >= 0 ? "＋" : ""}${m.value}：${m.label}（检定加值）`,
    );
  }
  if (level === 0) conditional.push("技能为 0 级：检定具有劣势");
  const inner = getEntry(build.activeInner);
  if (
    inner?.name === "正气歌" &&
    activeEffect(build).includes("具有优势") &&
    ["力量", "身法", "体魄", "内息", "气感", "神采"].includes(e?.grade ?? "")
  )
    conditional.push("正气歌：六项基础属性相关技能检定具有优势");
  if (name === "演奏") {
    const books = ownedItems(build).filter((i) => {
      const e = getEntry(i.id);
      return (
        e?.kind === "equipment" &&
        e.music &&
        ["金", "玉"].includes(e.music.bookGrade)
      );
    });
    const bonus = books.reduce((sum, i) => sum + i.quantity, 0);
    value += bonus;
    if (bonus)
      conditional.push(
        `已计入携带乐谱＋${bonus}：${books.map((i) => inventoryName(i) + " ×" + i.quantity).join("、")}（拓展书 72 页；只加检定结果，不增加技能等级）`,
      );
  }
  const sources = [
    ...build.equipment,
    ...build.inner
      .filter((x) => x.id === build.activeInner || x.level === 3)
      .map((x) => x.id),
    ...build.moves.map((x) => x.id),
    build.background,
    build.personality,
  ];
  for (const id of new Set(sources)) {
    const entry = getEntry(id);
    if (!entry || (entry.slot === "武器" && id !== build.activeWeapon))
      continue;
    const learned = build.inner.find((x) => x.id === id);
    const sourceText =
      entry.kind === "inner"
        ? [
            id === build.activeInner ? activeEffect(build) : "",
            learned?.level === 3 ? entry.permanent : "",
          ]
            .filter(Boolean)
            .join("。")
        : entry.text;
    const clauses = sourceText
      .replace(/\n/g, "")
      .split(/[。；]/)
      .filter((t) => t.includes("[" + name + "]") && /检定|优势|劣势/.test(t));
    for (const clause of clauses) {
      if (clause.includes("对方") || clause.includes("目标进行")) continue;
      if (entry.kind === "move" || entry.kind === "special") {
        conditional.push(
          `${entry.name}：有${name}相关条件，请按当前阶段核对该招完整说明。`,
        );
      } else if (
        !c.details.some(
          (m) => m.key === "check:" + name && m.label.includes(entry.name),
        )
      ) {
        conditional.push(`${entry.name}：${clause}（情境条件请核对）`);
      }
    }
  }
  return { entry: e, value, conditional: [...new Set(conditional)] };
}
