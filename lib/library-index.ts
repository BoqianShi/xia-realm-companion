import { catalog, inventoryCategory, weaponOf } from "./catalog.ts";
import type { Build, Entry } from "./types.ts";

export const librarySections = [
  {
    id: "inner",
    label: "内功",
    group: "功法",
    unit: "门",
    description: "决定运行时的六项属性；修满的永久收益单独保留。",
  },
  {
    id: "routine",
    label: "武学套路",
    group: "功法",
    unit: "套",
    description:
      "先选一套武学，再展开其中的实招、虚招、架招等招式；每招可以单独学习。",
  },
  {
    id: "special",
    label: "独立散手",
    group: "功法",
    unit: "招",
    description: "不属于整套武学的独立招式，逐招查看与学习。",
  },
  {
    id: "lightness",
    label: "轻功",
    group: "功法",
    unit: "门",
    description: "移动与身法相关功法，查看施展条件与效果。",
  },
  {
    id: "music",
    label: "乐谱",
    group: "功法",
    unit: "首",
    description: "通读乐谱后精通对应乐曲；持有书籍与学会招式分别记录。",
  },
  {
    id: "formation",
    label: "阵法",
    group: "功法",
    unit: "种",
    description: "多人结阵的条件、阵法效果及配套战法，供桌边查阅。",
  },
  {
    id: "basic",
    label: "基础招式",
    group: "功法",
    unit: "招",
    description: "规则书列出的通用基础招式，不归入某个门派套路。",
  },
  {
    id: "equipment",
    label: "装备与道具",
    group: "人物与物品",
    unit: "件",
    description: "查看武器、防具、药品和随身道具的属性与用途。",
  },
  {
    id: "sect",
    label: "门派",
    group: "人物与物品",
    unit: "项",
    description: "各门派的介绍与规则。",
  },
  {
    id: "background",
    label: "身世",
    group: "人物与物品",
    unit: "项",
    description: "查看身世带来的技能、物品与开局选择。",
  },
  {
    id: "personality",
    label: "性格",
    group: "人物与物品",
    unit: "项",
    description: "查看性格的技能选择。",
  },
  {
    id: "meridian",
    label: "经脉",
    group: "人物与物品",
    unit: "条",
    description: "查看经脉收益与冲关要求。",
  },
  {
    id: "skill",
    label: "技能与技艺",
    group: "规则查阅",
    unit: "项",
    description: "查看检定用途和规则说明。",
  },
  {
    id: "status",
    label: "状态",
    group: "规则查阅",
    unit: "种",
    description: "查看状态效果，供现场手动判断和记录。",
  },
  {
    id: "reference",
    label: "原书与待核对资料",
    group: "规则查阅",
    unit: "项",
    description: "原书全文，以及尚未完整拆分或确认归属的资料；保留原文供核对。",
  },
] as const;
export type LibrarySection = (typeof librarySections)[number]["id"];
export type LibraryNode = {
  entry: Entry;
  section: LibrarySection;
  moves: Entry[];
  searchable: string;
};
export type LibraryFilter = {
  query?: string;
  section?: LibrarySection | "all";
  book?: string;
  grade?: string;
  affinity?: string;
  sect?: string;
  weapon?: string;
  itemCategory?: string;
};
const compact = (s: string) => s.replace(/\s+/g, "").toLocaleLowerCase();
const children = new Map<string, Entry[]>();
for (const entry of catalog) {
  if (entry.parentId)
    children.set(entry.parentId, [
      ...(children.get(entry.parentId) ?? []),
      entry,
    ]);
}
export const routineMoves = (entry: Entry) => children.get(entry.id) ?? [];
export function librarySection(entry: Entry): LibrarySection {
  if(entry.kind === "move" && entry.grade === "基础") return "basic";
  if (entry.kind === "special")
    return entry.music ? "music" : entry.lightness ? "lightness" : "special";
  if (entry.kind === "routine") {
    // These source headings were mistaken for routines by the initial import.
    if (entry.source.book === "core" && [39, 40].includes(entry.source.pdfPage))
      return "status";
    if (/布阵人数[:：]/.test(entry.text)) return "formation";
    if (
      ["core-routine-413b3d366541", "core-routine-5e66601fd8f7"].includes(
        entry.id,
      )
    )
      return "lightness";
    return routineMoves(entry).length ? "routine" : "reference";
  }
  if (entry.kind === "move")
    return entry.parentId
      ? "routine"
      : entry.source.book === "core" && entry.source.pdfPage === 300
        ? "basic"
        : "reference";
  return entry.kind;
}
export function libraryLabel(entry: Entry) {
  if (entry.kind === "move" && entry.parentId) return "套路招式";
  return librarySections.find((s) => s.id === librarySection(entry))!.label;
}
export function canTrialEntry(entry: Entry) {
  if(entry.learnable === false) return false;
  if (entry.kind === "routine")
    return (
      librarySection(entry) === "routine" && routineMoves(entry).length > 0
    );
  return [
    "inner",
    "move",
    "special",
    "equipment",
    "meridian",
    "background",
    "personality",
    "sect",
  ].includes(entry.kind);
}
export const libraryNodes: LibraryNode[] = catalog
  .filter((entry) => {
    if (
      entry.kind === "move" &&
      entry.parentId &&
      entry.grade !== "基础" &&
      catalog.some((p) => p.id === entry.parentId && p.kind === "routine")
    )
      return false;
    // Keep one canonical state card, while legacy IDs remain available to saved records.
    if (entry.kind === "routine" && librarySection(entry) === "status")
      return !catalog.some((s) => s.kind === "status" && s.name === entry.name);
    return true;
  })
  .map((entry) => {
    const moves = entry.kind === "routine" ? routineMoves(entry) : [];
    return {
      entry,
      section: librarySection(entry),
      moves,
      searchable: compact(
        [
          entry.name,
          entry.sect,
          entry.text,
          ...moves.map((m) => `${m.name} ${m.text}`),
        ].join(" "),
      ),
    };
  });
export function matchingMoves(node: LibraryNode, query: string) {
  const q = compact(query);
  return q
    ? node.moves.filter((m) => compact(`${m.name} ${m.text}`).includes(q))
    : [];
}
export function filterLibrary(filter: LibraryFilter, nodes = libraryNodes) {
  const q = compact(filter.query ?? "");
  return nodes
    .filter((n) => {
      const e = n.entry;
      return (
        (!filter.section ||
          filter.section === "all" ||
          n.section === filter.section) &&
        (!q || n.searchable.includes(q)) &&
        (!filter.book || e.source.book === filter.book) &&
        (!filter.grade ||
          e.grade === filter.grade ||
          n.moves.some((m) => m.grade === filter.grade)) &&
        (!filter.affinity ||
          e.affinity === filter.affinity ||
          n.moves.some((m) => m.affinity === filter.affinity)) &&
        (!filter.sect || e.sect === filter.sect) &&
        (!filter.weapon ||
          weaponOf(e) === filter.weapon ||
          n.moves.some((m) => weaponOf(m) === filter.weapon)) &&
        (!filter.itemCategory ||
          (n.section === "equipment" &&
            inventoryCategory(e) === filter.itemCategory))
      );
    })
    .sort((a, b) => {
      // Names before body mentions; chapter text should not bury the actual named entry.
      const rank = (n: LibraryNode) =>
        !q
          ? 0
          : compact(n.entry.name) === q
            ? 0
            : compact(n.entry.name).includes(q)
              ? 1
              : n.moves.some((m) => compact(m.name).includes(q))
                ? 2
                : 3;
      return (
        rank(a) - rank(b) ||
        (a.entry.source.book === "core" ? 0 : 1) -
          (b.entry.source.book === "core" ? 0 : 1) ||
        a.entry.source.pdfPage - b.entry.source.pdfPage
      );
    });
}
export function learnedSummary(node: LibraryNode, build?: Build) {
  if (!build) return "";
  const e = node.entry;
  if (e.kind === "inner") {
    const learned = build.inner.find((i) => i.id === e.id);
    return learned
      ? `${build.activeInner === e.id ? "运行中" : "已学"} · ${["", "领悟", "小成", "圆满"][learned.level] ?? learned.level}`
      : "";
  }
  if (node.moves.length) {
    const count = node.moves.filter((m) =>
      build.moves.some((l) => l.id === m.id),
    ).length;
    return count ? `已学 ${count} / ${node.moves.length} 招` : "";
  }
  const learned = build.moves.find((i) => i.id === e.id);
  return learned
    ? `已学 · ${["", "领悟", "掌握", "精通", "合一"][learned.level]}`
    : "";
}
export function libraryExcerpt(entry: Entry) {
  const body = ["move", "special"].includes(entry.kind)
    ? entry.text.split(/升级[:：]/)[0]
    : entry.text;
  const lines = body
    .split("\n")
    .slice(1)
    .filter(
      (s) =>
        !/^(需求|属性|类型|距离|消耗|领悟|掌握|精通|修满|力\d|身\d)/.test(
          s.trim(),
        ),
    );
  return lines.join("").replace(/\s+/g, " ").slice(0, 150);
}

/** Builder selections use the same categories without flattening child moves into routines. */
export function matchesLearningCategory(entry: Entry, category: string) {
  if (!canTrialEntry(entry)) return false;
  if (category === "move") return entry.kind === "move";
  if (category === "routine")
    return entry.kind === "routine" && librarySection(entry) === "routine";
  return librarySection(entry) === category;
}

export function moveBrowseFacts(entry: Entry) {
  // Some PDF metadata share a line. Do not repeat the following field as part of distance.
  const distance = entry.distance?.split(/消耗[:：]/)[0].trim();
  const cost = entry.costText?.split(/(?:距离|升级|类型)[:：]/)[0].trim();
  return [
    cost ? `领悟消耗 ${/^\d/.test(cost) ? "内力 " : ""}${cost}` : "消耗见说明",
    distance
      ? `距离 ${distance}${/^\d+(?:[-–~～]\d+)?$/.test(distance) ? " 米" : ""}`
      : "",
  ].filter(Boolean);
}
