import type { Entry, MoveResult } from "./types.ts";

export const actionNames = {
  main: "主要动作",
  minor: "次要动作",
  simple: "简要动作",
  charge: "蓄力动作",
  reaction: "反应动作",
};
export const damageNames = {
  physical: "外功",
  internal: "内功",
  poison: "毒素",
  bleed: "流血",
  fire: "火焰",
  mental: "精神",
  none: "无直接伤害",
};
export const movePurposes: Record<string, string> = {
  实招: "攻击",
  虚招: "破架",
  架招: "防守",
  反击: "还击",
  绝招: "绝招",
};

export function cleanRuleText(text = "") {
  return text.replace(/\r/g, "").replace(/\n\s*/g, "").trim();
}

/** Preserve whole conditions, durations and state definitions; remove only display metadata. */
export function moveReference(entry: Entry, move: MoveResult) {
  const body = (entry.music ? "乐曲\n" + entry.music.baseEffect : entry.text)
    .split(/升级\s*[:：]/)[0]
    .split("\n")
    .filter(
      (line, i) =>
        i !== 0 &&
        !/^(类型|距离|消耗|需求)\s*[:：]/.test(line.trim()) &&
        !/^[-—].*[-—]$/.test(line.trim()),
    )
    .join("")
    .trim();
  const paragraphs = (body.match(/[^。！？]+[。！？]?/g) ?? [])
    .map((x) => x.trim().replace(/^[·•]+/, ""))
    .filter(Boolean);
  // Replace only the first unconditional, simple attribute formula with a reference to the computed panel.
  // Complex/multiple/conditional damage expressions remain verbatim instead of implying they were calculated.
  if (
    entry.formula?.terms.length &&
    paragraphs[0] &&
    !/若|如果|当|每|额外|多次|分别/.test(paragraphs[0])
  ) {
    paragraphs[0] = paragraphs[0].replace(
      /造成\d+(?:\.\d+)?(?:力量|身法|体魄|内息|气感|神采)(?:\s*[+＋]\s*\d+(?:\.\d+)?(?:力量|身法|体魄|内息|气感|神采))*点(?:内功|外功)伤害/,
      "造成面板所示的基础伤害",
    );
  }
  const upgrade = cleanRuleText(entry.upgrade);
  const simpleUpgrade =
    /^(招式伤害[+\-]\d+[，、]?|内力消耗[+\-]\d+[，、]?|怒气消耗[+\-]\d+[，、]?|格挡值[+\-]\d+[，、]?|。|\s)+$/.test(
      upgrade,
    );
  // Reviewed clauses: apply only to these stable source IDs, never infer arbitrary prose upgrades.
  const stageEffects: Record<string, [string, string]> = {
    "core-move-efffd2a3baef": ["招式伤害+5点", `招式伤害+${5 * move.rank}点`],
    "core-move-d2d50cfae877": ["则招式伤害+5", `则招式伤害+${5 * move.rank}`],
    "expansion-move-5d82f32726ae": ["招式暴击骰-1", `招式暴击骰-${move.rank}`],
  };
  stageEffects["core-move-5bf5a314e740"] = [
    "持续一回合",
    `持续${move.rank}回合`,
  ];
  stageEffects["expansion-move-e9e883aa8a9b"] = [
    "消耗三层开水",
    `消耗${Math.max(0, 4 - move.rank)}层开水`,
  ];
  const resolvedStage = stageEffects[entry.id];
  let effects = paragraphs
    .map((p) => (resolvedStage ? p.replace(...resolvedStage) : p))
    .filter((p) => !p.endsWith("造成面板所示的基础伤害。"));
  if (entry.id === "expansion-move-96ee14188dc5")
    effects = [
      `主要动作，形成随你移动的无涯气场，范围 ${move.rank + 2} 米，持续 ${move.rank + 2} 回合。`,
      `区域内友方招式伤害 +${move.rank * 5}，每回合末回复 5 内力。`,
      "你只能拥有一个无涯；形成新气场时旧气场消失。不同无涯的效果不可叠加。",
    ];
  if (!effects.length && paragraphs.length)
    effects.push("命中后造成面板所示的基础伤害。");
  const warnings = move.warnings.filter(
    (w) =>
      !w.startsWith("效果待处理：") && !w.startsWith("阶段附加效果请核对："),
  );
  const upgrades = move.rank - 1;
  const stageBreakdown =
    entry.id === "core-move-efffd2a3baef"
      ? [
          `条件加伤：初始 5 ＋ ${upgrades} 次升级 × 5 ＝ ${5 * move.rank}，未计入上方基础伤害。`,
          ...(upgrades > 0
            ? [
                `升级还让基础伤害累计＋${5 * upgrades}、内力消耗累计＋${upgrades}；这两项已计入上方面板，不要重复添加。`,
              ]
            : []),
          ...(move.damage !== null
            ? [
                `条件成立时，普通伤害 ${move.damage} ＋ ${5 * move.rank} ＝ ${move.damage + 5 * move.rank}（未扣目标防御与格挡）。`,
              ]
            : []),
          `同一目标满足条件后，每次的额外伤害固定为 ${5 * move.rank}，不会按此前命中次数继续累加。`,
        ]
      : [];
  return {
    effects,
    stageBreakdown,
    upgrade:
      !simpleUpgrade &&
      !resolvedStage &&
      entry.id !== "expansion-move-96ee14188dc5"
        ? upgrade
        : "",
    warnings,
  };
}

export function equipmentReference(entry: Entry) {
  const lines = entry.text.split("\n");
  const body = cleanRuleText(
    lines.length > 1 ? lines.slice(1).join("\n") : entry.text,
  );
  const effect =
    body.match(/(?:特效|效果)\s*[:：]([\s\S]+)/)?.[1] ??
    body.replace(/伤害\s*\d+\s*格挡\s*\d+/, "");
  const price = entry.text
    .split("\n")[0]
    .match(/(?:银|金|铜|黄金|白银)\s*\d+(?:\.\d+)?\s*(?:两|文)/)?.[0];
  return {
    effect,
    price,
    type:
      [entry.weapon, entry.subtype].filter(Boolean).join(" · ") ||
      entry.slot ||
      "道具",
  };
}
