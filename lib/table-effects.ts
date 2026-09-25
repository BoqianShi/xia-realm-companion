import { catalog, effectiveMoves, getEntry, rankLabel, sourceLabel } from "./catalog.ts";
import { calculateCharacter, calculateMove } from "./rules.ts";
import { movePresentation } from "./move-presentation.ts";
import { moveHeadline } from "./move-book.ts";
import { cleanRuleText, moveReference } from "./reference-presentation.ts";
import type { Build, Rulings } from "./types.ts";

/** Read-only descriptions. A buff's recipient does not establish its caster's stage. */
export function namedEffect(name: string) {
  if (name.trim() === "化劲" && getEntry("core-inner-24c32455f93c")) return { text: "出招时每消耗一层化劲，招式伤害 +10；最多十层，持续至脱战。", source: sourceLabel(getEntry("core-inner-24c32455f93c")!), stageDependent: false, entryId: "core-inner-24c32455f93c" };
  const matches = catalog.filter(e => ["status", "move", "special"].includes(e.kind) &&
    e.name.split(/[／/]/).includes(name.trim()));
  if (matches.length !== 1) return null;
  const entry = matches[0];
  const lines = entry.text.split("\n").slice(1).filter(line => !/^(类型|距离|消耗|需求)\s*[:：]/.test(line.trim()));
  const text = entry.kind === "status"
    ? cleanRuleText(lines.join("\n")).split("·").filter(Boolean).slice(lines.some(l => l.startsWith("·")) ? 1 : 0).join(" ")
    : cleanRuleText(lines.join("\n"));
  return { text, source: sourceLabel(entry), stageDependent: entry.kind !== "status", entryId: entry.id };
}

export function effectDescription(value: { name: string; effect?: string }) {
  const known = namedEffect(value.name);
  return value.effect?.trim()
    ? { text: value.effect.trim(), source: "现场记录", stageDependent: false, entryId: "" }
    : known;
}

export function stanceReference(build: Build, id: string, rules?: Rulings) {
  const learned = effectiveMoves(build).find(m => m.id === id), entry = getEntry(id);
  if (!id) return { name: "未开启架招", block: calculateCharacter(build).block, summary: "", details: [] as string[], meta: "", entryId: "" };
  if (!learned || entry?.moveType !== "架招")
    return { name: entry?.name ?? "架招资料暂缺", block: null, summary: "这条架招记录未对应到已学招式，请重新选择。", details: [] as string[], meta: "", entryId: id };
  const move = calculateMove(build, id, learned.level, rules), p = movePresentation(entry, move, build), ref = moveReference(entry, move);
  return {
    name: entry.name, block: move.block,
    summary: moveHeadline(entry, move).reviewed ? p.headline : ref.effects.join(" ") + (ref.upgrade && move.rank > 1 ? ` 升级效果：${ref.upgrade}` : ""),
    details: ref.effects,
    meta: [entry.routine, rankLabel(entry, learned.level), p.action, `消耗 ${p.cost}`, `需求 ${p.requirement}`].filter(Boolean).join(" · "),
    entryId: id,
  };
}
