import { catalog, getEntry } from "./catalog.ts";
import { backgroundBenefits } from "./onboarding.ts";
import { isFavoriteMove } from "./move-favorites.ts";
import { cleanRuleText, moveReference } from "./reference-presentation.ts";
import type { Build, Entry, Learned, MoveResult } from "./types.ts";

export type MoveGroup = {
  id: string;
  name: string;
  entry?: Entry;
  moves: Learned[];
  total: number;
  subtitle: string;
};
const typeOrder = ["实招", "虚招", "架招", "反击", "绝招", "气招"];
const catalogOrder = new Map(catalog.map((e, i) => [e.id, i]));

/** IDs, rather than names, distinguish different editions of the same routine. */
export function groupMoves(moves: Learned[]): MoveGroup[] {
  const groups = new Map<string, MoveGroup>();
  for (const learned of moves) {
    const e = getEntry(learned.id);
    const parent = e?.parentId ? getEntry(e.parentId) : undefined;
    const routine =
      e?.grantedBy ? getEntry(e.grantedBy) :
      e?.kind === "special" && catalog.some(x => x.grantedBy === e.id) ? e :
      e?.music && e.kind === "special"
        ? getEntry(e.music.bookId)
        : parent?.kind === "routine"
          ? parent
          : undefined;
    const fallback = e?.lightness
      ? "lightness"
      : e?.kind === "special"
        ? "special"
        : "ungrouped";
    const id =
      routine?.id ??
      (e?.routine ? `${e.source.book}:unlinked:${e.routine}` : fallback);
    if (!groups.has(id))
      groups.set(id, {
        id,
        name:
          routine?.name ??
          e?.routine ??
          {
            lightness: "轻功",
            special: "独立散手",
            ungrouped: "其他招式 · 归属待核对",
          }[fallback],
        entry: routine,
        moves: [],
        total: e?.music
          ? 1
          : routine
            ? catalog.filter((x) => x.parentId === routine.id || x.grantedBy === routine.id || (routine.kind === "special" && x.id === routine.id)).length
            : 0,
        subtitle: routine
          ? [
              routine.grade,
              routine.affinity,
              routine.requirement?.split(/属性[:：]/)[0].trim(),
            ]
              .filter(Boolean)
              .join(" · ")
          : fallback === "special"
            ? "独立学习，不属于整套武学"
            : fallback === "lightness"
              ? "移动与身法相关功法"
              : "按资料原有记录展示，不推定所属武学",
      });
    groups.get(id)!.moves.push(learned);
  }
  for (const group of groups.values()) {
    if (!group.entry) group.total = group.moves.length;
    group.moves.sort((a, b) => {
      const rank = (id: string) => {
        const i = typeOrder.indexOf(getEntry(id)?.moveType ?? "");
        return i < 0 ? typeOrder.length : i;
      };
      return (
        rank(a.id) - rank(b.id) ||
        (catalogOrder.get(a.id) ?? 99999) - (catalogOrder.get(b.id) ?? 99999)
      );
    });
  }
  return [...groups.values()].sort(
    (a, b) => Number(!a.entry) - Number(!b.entry),
  );
}

export function learningSource(build: Build, learned: Learned) {
  const origin = learned.origin;
  const entry = getEntry(learned.id);
  if (entry?.grantedBy) {
    const parent = getEntry(entry.grantedBy);
    return { confirmed: true, label: `随《${parent?.name}》获得`, detail: "这是该散手的施展效果，阶段随所属散手变化，不单独花费修为，也不重复增加武器技能或悟性。", entry: parent };
  }
  if (origin) {
    const source = getEntry(origin.entryId);
    return {
      confirmed: true,
      label:
        entry?.music && entry.kind === "special"
          ? `通读乐谱 · ${getEntry(entry.music.bookId)?.name ?? entry.name}`
          : origin.kind === "background"
            ? `身世赠送 · ${source?.name ?? "原身世"}`
            : origin.kind === "starter"
              ? "入门示范选配"
              : origin.kind === "routine"
                ? `整套加入 · ${source?.name ?? entry?.routine ?? "武学"}`
                : "逐招选择",
      detail:
        entry?.music && entry.kind === "special"
          ? `通读乐谱需 ${entry.music.learnCost} 修为，直接精通对应乐曲；持有书籍与学会招式分别记录。`
          : origin.kind === "background"
            ? `创建人物时由「${source?.name ?? "原身世"}」身世加入。后续修炼保留这条获得记录。`
            : origin.kind === "starter"
              ? "使用当前资料包的入门示范时加入；这是示范构筑的选择，不代表所有该门派角色自动学会。"
              : origin.kind === "routine"
                ? `选择整套《${source?.name ?? entry?.routine ?? "武学"}》时加入；每招仍独立记录掌握阶段。`
                : "通过单个招式的学习或试配入口加入。",
      entry: source,
    };
  }
  const benefit = backgroundBenefits(build.background).routine;
  const related =
    benefit && (entry?.id === benefit.id || entry?.parentId === benefit.id);
  const name = getEntry(build.background)?.name;
  return {
    confirmed: false,
    label: related ? `${name}身世可获得 · 旧卡未记来源` : "旧卡未记录获得方式",
    detail: related
      ? `当前「${name}」身世的规则包含《${benefit.name}》。这张旧卡未保存实际学习记录，因此这里只提示规则关联，不认定它当时一定来自身世赠送。`
      : "旧版本只保存了已学招式和阶段。所属武学可以核对，实际来自开局、逐招学习或其他途径未记录。今后新加入的招式会保存获得方式。",
    entry: related ? getEntry(build.background) : undefined,
  };
}

/** Reviewed short descriptions use stable source IDs and preserve their trigger conditions. */
export function moveHeadline(entry: Entry, move: MoveResult) {
  const short: Record<string, string> = {
    "core-move-109bb469b5d5": "破架成功 → 目标倒地，并下盘不稳 1 回合。",
    "core-move-86ff096dd4f1":
      "开启「苦读」 → 受到的内外功伤害减免 5；脱战或解除架招时结束。",
    "core-move-d2d50cfae877": `有「苦读」时念诗；对方书写检定（难度 13）失败或没听过，伤害额外 +${move.rank * 5}。`,
    "core-move-0407a767fa8f":
      "看破虚招后还击、压制虚招，并附加 1 层流血，持续到脱战。",
    "core-move-c2d5a65b94b3":
      "有「苦读」时将其换成「及第」：书写等级低于你的目标，对你造成的内外功伤害 −20，持续到脱战。",
    "expansion-move-694fa3da2516":
      "格挡成功得「笔势」，最多 3 层；每层笔法命中 +10，脱战或换其他武器套路时结束。",
    "expansion-move-5d82f32726ae": `出招前可做书写检定；结果 ≥15，本招暴击骰 −${move.rank}。`,
    "expansion-move-43253548e9cd":
      "破架成功 → 拉倒目标；书写等级 ≥5 时，虚招值 +2。",
    "expansion-move-497452dfc254":
      "看破虚招后还击、压制虚招；可移除「笔势」，使目标禁足 1 回合。",
    "expansion-move-55122891b175":
      "本场战斗已施展本套前四招 → 本招伤害额外 +20。",
    "core-move-efffd2a3baef": `目标本场已被你这招造成过伤害 → 本招伤害额外 +${move.rank * 5}（${move.rank > 1 ? `初始 5＋升级 ${5 * (move.rank - 1)}；` : ""}未计入面板）。`,
  };
  if (short[entry.id]) return { text: short[entry.id], reviewed: true };
  const ref = moveReference(entry, move);
  const chosen =
    ref.effects.find((x) =>
      /若|当|时|后|每|获得|回复|移除|流失|倒地|持续/.test(x),
    ) ?? ref.effects[0];
  return {
    text: `${ref.upgrade && move.rank > 1 ? "领悟阶段效果（升级见展开）：" : ""}${cleanRuleText(chosen) || "效果请展开核对原文。"}`,
    reviewed: false,
  };
}

export function filterGroupMoves(
  group: MoveGroup,
  build: Build,
  filter: { query: string; type: string; favorites: boolean },
) {
  const query = filter.query.trim().toLocaleLowerCase();
  return group.moves.filter((item) => {
    const e = getEntry(item.id);
    return (
      (!filter.favorites || isFavoriteMove(build, item.id)) &&
      (filter.type === "全部" || (e?.moveType ?? "散手") === filter.type) &&
      (!query ||
        `${group.name} ${e?.name ?? ""} ${cleanRuleText(e?.text)} ${learningSource(build, item).label}`
          .toLocaleLowerCase()
          .includes(query))
    );
  });
}
