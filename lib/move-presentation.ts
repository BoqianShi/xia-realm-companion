import { moveCosts } from "./move-preview.ts";
import { actionText, releaseModes } from "./move-semantics.ts";
import type { Build, Entry, MoveResult } from "./types.ts";
import { getEntry } from "./catalog.ts";
import { cleanRuleText } from "./reference-presentation.ts";
import { skillCheck } from "./tabletop.ts";
import { moveHeadline } from "./move-book.ts";
const sea = "expansion-move-96ee14188dc5";
export function movePresentation(entry: Entry, move: MoveResult, build: Build) {
  const raw = cleanRuleText(
    entry.music?.baseEffect ?? entry.text.split(/升级[:：]/)[0],
  );
  const reviewed: Record<string, string> = {
    "core-move-5bf5a314e740": `破架成功 → 目标禁足 ${move.rank} 回合。`,
    "core-move-eb1b3b8d521e": "格挡成功 → 不会被这次攻击添加状态。",
    "core-move-938f44e53e14":
      "命中无架招目标 → 其周围 1 米单位做轻功检定（难度 18）；失败则流失本招所造成伤害一半的气血。",
    "expansion-move-c78caeb541b1":
      "格挡成功得 1 层劲力，最多 3 层；每层招式伤害 +5，持续至脱战。",
    "expansion-move-268ec2ac5e7e": "破架成功 → 目标下盘不稳 2 回合。",
    "expansion-move-c86895224971": "命中无架招敌人 → 额外获得 1 怒气。",
    "expansion-move-5504b9de0f77": "命中无架招敌人 → 目标错骨 1 回合。",
    "expansion-move-008c094e0f22":
      "开启架招，同时获得 1 层开水，最多 3 层；每层使倒提壶招式伤害 +5，持续至脱战。",
    "expansion-move-ce9e6db7b063":
      "攻击周围敌人；有开水时，每层另使目标流失 5 气血。",
    "expansion-move-95964840894b": "有开水时，每层另使目标流失 10 气血。",
    "expansion-move-e9e883aa8a9b": `一名友方用反应动作吃下，获得佳肴及茶叶效果；可消耗 ${Math.max(0, 4 - move.rank)} 层开水，使自己也获得效果。`,
    [sea]: `范围内友方招式伤害 +${move.rank * 5}，每回合末回复 5 内力；气场随你移动，持续 ${move.rank + 2} 回合。`,
  };
  let headline =
    reviewed[entry.id] ??
    (entry.music ? entry.music.baseEffect : moveHeadline(entry, move).text);
  if (entry.music && entry.name === "清商")
    headline = "范围内所有友方回复 10 内力。";
  const passive =
    entry.kind === "special" &&
    !entry.moveType &&
    !entry.costText &&
    !/动作/.test(entry.text);
  const action = passive ? "常驻 / 条件生效" : releaseModes(entry).map(actionText).join(" / ");
  const requirement =
    entry.requirement?.split(/属性[:：]/)[0].trim() ||
    getEntry(entry.parentId ?? "")
      ?.requirement?.split(/属性[:：]/)[0]
      .trim() ||
    "原书未列";
  const targets = raw.match(
    /范围内所有(?:无架招的)?[友敌]方(?:目标|角色)?|范围内[友敌]方|周围敌人|一(?:个|名)友方(?:目标)?|区域内友方/,
  )?.[0];
  const duration = raw.match(
    /持续(?:到|至)?(?:战斗脱离|脱战|[一二三四五六七八九十\d]+回合)/,
  )?.[0];
  const restrictions = raw
    .split(/[。]/)
    .filter((x) => /不可叠加|不能叠加|只能拥有/.test(x))
    .map((x) => x.replace(/^·/, ""));
  const cost = moveCosts(entry, build, move.rank).map(c => `${c.label} ${c.value ?? c.detail}`).join(" · ");
  const range =
    entry.id === sea
      ? `作用范围 ${move.rank + 2} 米`
      : move.distance
        ? `距离 / 范围 ${move.distance} 米`
        : /自身/.test(entry.distance ?? "")
          ? "自身"
          : "范围见效果";
  const trigger = entry.music
    ? `施展前成功演奏：D20＋${skillCheck(build, "演奏").value}（演奏） ≥ ${entry.music.difficulty}`
    : undefined;
  const primary =
    entry.id === sea
      ? { label: "气场 · 友方招式伤害", value: `＋${move.rank * 5}` }
      : entry.name === "清商" && entry.music
        ? { label: "友方回复内力", value: "10" }
        : undefined;
  return {
    primary,
    headline,
    action,
    requirement,
    affinity: entry.affinity ?? "未列",
    range,
    target: targets ?? (entry.moveType === "架招" ? "自身" : undefined),
    duration: entry.id === sea ? `${move.rank + 2} 回合` : duration,
    restrictions,
    cost,
    trigger,
    conditional: entry.music
      ? `天籁之音 · ${entry.music.sequence} → ${entry.music.bonus}${entry.name === "清商" ? "（合计回复 20 内力）" : ""}`
      : undefined,
  };
}
