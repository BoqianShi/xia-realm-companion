import { catalog } from "./catalog.ts";
import { modules } from "./modules.ts";
import {
  encounterPeople,
  adventureEncounters,
} from "./adventure-encounters.ts";
import type { EntityRef } from "./hosting-schema.ts";
import type { Campaign } from "./types.ts";
export type ContextHit = {
  ref: EntityRef;
  name: string;
  group: string;
  text: string;
};
export const entityKey = (r: EntityRef) =>
  [r.kind, r.moduleId ?? "", r.id].join(":");
export const ruleHits: ContextHit[] = catalog
  .filter((e) => e.kind !== "reference")
  .map((e) => ({
    ref: { kind: "rule", id: e.id },
    name: e.name,
    group: e.routine
      ? `招式 · ${e.routine}`
      : e.kind === "inner"
        ? "内功"
        : "规则资料",
    text: e.text,
  }));
export const npcHits: ContextHit[] = Object.entries(encounterPeople).flatMap(
  ([moduleId, npcs]) =>
    npcs.map((n) => ({
      ref: { kind: "npc", id: n.id, moduleId },
      name: n.name,
      group: modules.find((m) => m.id === moduleId)?.title ?? "人物",
      text: [
        n.description,
        n.note,
        ...n.fields.map((f) => f.label + f.value),
        ...n.moves.map((m) => m.name + " " + m.effect),
      ].join("\n"),
    })),
);
export function contextHits(c?: Campaign | null): ContextHit[] {
  return [
    ...ruleHits,
    ...npcHits,
    ...adventureEncounters.map((e) => ({
      ref: { kind: "encounter" as const, id: e.id, moduleId: e.moduleId },
      name: e.title,
      group: "遭遇",
      text: e.trigger + " " + e.notes.join(" "),
    })),
    ...(c?.hosting?.scenes ?? []).map((s) => ({
      ref: { kind: "scene" as const, id: s.id, moduleId: s.moduleId },
      name: s.title,
      group: "场景",
      text: s.text + " " + s.dmNotes,
    })),
    ...(c?.characters ?? []).map((ch) => ({
      ref: { kind: "character" as const, id: ch.id },
      name: ch.build.name,
      group: "队友",
      text:
        ch.build.notes +
        " " +
        (ch.table?.notes ?? []).map((n) => n.text).join(" "),
    })),
  ];
}
export function resolveEntity(r: EntityRef, c?: Campaign | null) {
  return contextHits(c).find((h) => entityKey(h.ref) === entityKey(r));
}
// Only exact, unique names in this module; short/general words and ambiguous rule names are never linked.
export function proseEntities(text: string, moduleId: string): ContextHit[] {
  const candidates = [
    ...npcHits.filter((n) => n.ref.moduleId === moduleId),
    ...ruleHits.filter((r) => r.name.length >= 3 && text.includes(r.name)),
  ];
  const count = new Map<string, number>();
  for (const h of candidates) count.set(h.name, (count.get(h.name) ?? 0) + 1);
  return candidates
    .filter(
      (h) =>
        h.name.length >= 2 && count.get(h.name) === 1 && text.includes(h.name),
    )
    .sort((a, b) => b.name.length - a.name.length);
}
