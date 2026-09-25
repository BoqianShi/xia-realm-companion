import { contentPack } from "./content-pack.ts";
import type { ModuleNpc } from "./module-types.ts";
import type { StageUnit } from "./hosting-schema.ts";

export type EncounterActor = {
  id: string;
  npcId: string;
  name: string;
  count: number | null;
  role: "opening" | "reserve" | "support";
  side: "ally" | "enemy";
  note: string;
  optional: boolean;
  maximum: number | null;
  hp: number | null;
  hpDelta: number | null;
  track: boolean;
};
export type AdventureEncounter = {
  id: string;
  moduleId: string;
  title: string;
  kind: string;
  pages: number[];
  trigger: string;
  cast: EncounterActor[];
  notes: string[];
};
export const encounterVersion = contentPack.revision;
export const adventureEncounters = contentPack.encounters as AdventureEncounter[];
export const encounterPeople = Object.fromEntries(contentPack.modules.map(m => [m.id, m.npcs])) as Record<string, ModuleNpc[]>;
export const getAdventureEncounter = (id: string) =>
  adventureEncounters.find((e) => e.id === id);
export const encounterNpc = (moduleId: string, npcId: string) =>
  encounterPeople[moduleId]?.find((n) => n.id === npcId);
export function initialEncounterCounts(
  e: AdventureEncounter,
): Record<string, number | null> {
  return Object.fromEntries(
    e.cast.map((a) => [a.id, a.optional && a.side === "ally" ? 0 : a.count]),
  );
}
export function encounterIssues(
  e: AdventureEncounter,
  counts: Record<string, number | null>,
): string[] {
  const issues: string[] = [];
  for (const a of e.cast.filter((a) => a.role !== "support")) {
    const n = counts[a.id];
    if (
      n === null ||
      n === undefined ||
      !Number.isInteger(n) ||
      n < 0 ||
      n > 30
    ) {
      issues.push(`${a.name}：请填写本场人数。`);
      continue;
    }
    const isFinale = e.id === "chengyun-finale" && a.id === e.cast[0].id;
    if (
      isFinale
        ? ![1, 2].includes(n)
        : a.count !== null && n !== a.count && !(a.optional && n === 0)
    )
      issues.push(`${a.name}：人数与此遭遇原文不符。`);
    if (a.maximum && (n > a.maximum || (e.id === "biaoxing-quarters" && n < 7)))
      issues.push(`${a.name}：原文为七八名，请填写 7 或 8。`);
    if (a.count === null && n === 0)
      issues.push(`${a.name}：人数尚未确定，不能用 0 代替。`);
  }
  return issues;
}
export function encounterUnits(
  e: AdventureEncounter,
  counts: Record<string, number | null>,
): StageUnit[] {
  const ordinal = new Map<string, number>();
  return e.cast
    .filter((a) => a.role !== "support" || a.track)
    .flatMap((a) => {
      const npc = encounterNpc(e.moduleId, a.npcId)!;
      const number = (labels: string[]) => {
        const v = npc.fields
          .find((f) => labels.includes(f.label))
          ?.value.trim();
        return v && /^\d+$/.test(v) ? Number(v) : null;
      };
      const stamina =
        npc.kind === "beast" || npc.fields.some((f) => f.label === "体力");
      const hp = number(stamina ? ["体力"] : ["气血上限", "气血"]);
      const hpMax = hp === null ? null : Math.max(0, hp + (a.hpDelta ?? 0));
      const mp = number(["内力上限", "内力"]);
      const total = e.cast
        .filter((c) => c.name === a.name)
        .reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);
      return Array.from({ length: counts[a.id] ?? 0 }, () => {
        const index = (ordinal.get(a.name) ?? 0) + 1;
        ordinal.set(a.name, index);
        return {
          id: crypto.randomUUID(),
          name: a.name + (total > 1 ? ` ${index}` : ""),
          side: a.side,
          characterId: "",
          moduleId: e.moduleId,
          npcId: a.npcId,
          score: null,
          bonus: number(["先攻", "先攻加值"]),
          die: null,
          out: false,
          hidden: false,
          publicName: "",
          reserve: a.role === "reserve",
          offstage: a.role === "support",
          scriptActorId: a.id,
          hp: a.hp ?? hpMax,
          hpMax,
          mp,
          mpMax: mp,
          healthLabel: stamina ? ("体力" as const) : ("气血" as const),
          conditions: "",
          note: a.note,
        };
      });
    });
}
