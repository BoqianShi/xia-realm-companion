import { ruleNotes, noteLabels } from "./rule-notes.ts";
import { getEntry, sourceLabel } from "./catalog.ts";
import type { Build, CharacterResult, MoveResult, Rulings } from "./types.ts";
import { STAT_NAMES } from "./types.ts";
import { calculateCharacter } from "./rules.ts";
import { skillCheck } from "./tabletop.ts";

export type Explanation = {
  title: string;
  formula: string;
  rows: { label: string; value: number | string }[];
  notes: string[];
  source?: string;
};
export const statLabels: Record<string, string> = {
  ...STAT_NAMES,
  hpMax: "气血上限",
  mpMax: "内力上限",
  physicalHit: "外功命中",
  internalHit: "内功命中",
  physicalDefense: "外功防御",
  internalDefense: "内功防御",
  physicalCrit: "外功暴击门槛",
  internalCrit: "内功暴击门槛",
  dodge: "闪避",
  speed: "速度",
  initiative: "先攻加值",
  block: "未开架招格挡",
  lookThrough: "看破",
  insight: "悟性",
};
export function explainStat(c: CharacterResult, key: string): Explanation {
  const s = c.stats;
  const rows = c.details
    .filter((x) => x.key === key && x.value !== 0)
    .map((x) => ({ label: x.label, value: x.value }));
  const base: Record<string, [string, number]> = {
    hpMax: [
      `体魄 ${s.body} × 4 ＋ 力量 ${s.strength}`,
      s.body * 4 + s.strength,
    ],
    mpMax: [`内息 ${s.breath}`, s.breath],
    physicalHit: [`身法 ${s.agility} ÷ 2，向下取整`, Math.floor(s.agility / 2)],
    internalHit: [`气感 ${s.qi} ÷ 2，向下取整`, Math.floor(s.qi / 2)],
    physicalDefense: [`体魄 ${s.body} ÷ 5，向下取整`, Math.floor(s.body / 5)],
    internalDefense: [
      `内息 ${s.breath} ÷ 3，向下取整`,
      Math.floor(s.breath / 3),
    ],
    physicalCrit: [
      `20 − ⌊力量 ${s.strength} ÷ 20⌋`,
      20 - Math.floor(s.strength / 20),
    ],
    internalCrit: [`20 − ⌊气感 ${s.qi} ÷ 20⌋`, 20 - Math.floor(s.qi / 20)],
    dodge: [`10 ＋ ⌊身法 ${s.agility} ÷ 4⌋`, 10 + Math.floor(s.agility / 4)],
    speed: [
      `5 ＋ 轻功等级 ${c.skills["轻功"] ?? 0} ÷ 2，再向下取整`,
      Math.floor(5 + (c.skills["轻功"] ?? 0) / 2),
    ],
    initiative: [
      `身法 ${s.agility} ÷ 10，向下取整`,
      Math.floor(s.agility / 10),
    ],
    lookThrough: [`武学内功技能等级`, c.skills["武学内功"] ?? 0],
  };
  const info: Record<string, string> = {
    hpMax: "这是上限；当前气血由你手动记账。上限向下取整，最低为 1。",
    mpMax: "这是上限；出招不会自动扣内力。上限向下取整，最低为 0。",
    physicalHit: "使用实体 D20 加此值，与目标闪避比较。",
    internalHit: "使用实体 D20 加此值，与目标闪避比较。",
    physicalCrit:
      "看命中骰的原始点数，不是加了命中后的总和。数值越低，越容易达到门槛；反击等例外按招式说明。",
    internalCrit:
      "看命中骰的原始点数，不是加了命中后的总和。数值越低，越容易达到门槛；反击等例外按招式说明。",
    physicalDefense: "处理外功伤害时使用；防御、格挡与气血流失是不同规则。",
    internalDefense: "处理内功伤害时使用；防御、格挡与气血流失是不同规则。",
    initiative: "先攻检定为 D20 加此值。在先攻页可自动掷骰并排序，主持人控制开始与推进。",
    lookThrough: "用于对抗虚招；具体对抗条件在桌上判断。",
    speed: "单位为米。桌边状态只作提醒，不会自动折算移动距离。",
  };
  const value =
    key in s ? s[key as keyof typeof s] : c[key as keyof CharacterResult];
  if (key === "block")
    return {
      title: statLabels[key],
      formula: "未开启架招：格挡 0",
      rows: [],
      notes: [
        "开启架招后的格挡取决于该招、当前武器及已支持加成，请点该架招的格挡数值查看。",
      ],
    };
  if (key === "insight")
    return {
      title: "悟性",
      formula:
        "基础悟性 ＋ 最高内功境界贡献 ＋ 招式修炼贡献，再应用上限与额外加成",
      rows: [
        { label: "最高内功境界贡献", value: c.realm },
        ...rows,
        { label: "当前悟性", value: c.insight },
      ],
      notes: [
        "人级精通招式每招＋1（最多10）；地级精通每招＋1（最多10）；天级精通＋1、合一＋2。轻功不计。",
        "基础与修炼部分通常上限30，生死玄关后40；额外悟性另计。",
      ],
    };
  if (base[key]) rows.unshift({ label: base[key][0], value: base[key][1] });
  return {
    title: statLabels[key] ?? key,
    formula: base[key]
      ? `${base[key][0]} ＋ 下列额外加成 ＝ ${value}`
      : `各来源相加 ＝ ${value}`,
    rows,
    notes: [
      info[key] ?? "运行内功只计算当前一门；修满的永久收益保留且只加一次。",
      "桌边记录的状态不自动修改此面板。",

    ],
    source: base[key]
      ? "正式书 · 10 页；额外加成见各来源"
      : "当前角色构筑的属性来源",
  };
}

export function explainMove(
  move: MoveResult,
  kind: "damage" | "critical" | "cost" | "block",
  rules?: Rulings,
): Explanation {
  const e = getEntry(move.id);
  const f = e?.formula;
  const title = {
    damage: "基础伤害",
    critical: "适用暴击伤害",
    cost: "招式消耗",
    block: "基础格挡",
  }[kind];
  const notes = ruleNotes(move.warnings, {entry:e,hideShared:true}).map(n=>`${noteLabels[n.kind]}：${n.text}`);
  let rows = move.details;
  let formula = "按以下来源计算";
  if (kind === "damage") {
    formula = `属性系数 ＋ 修炼成长 ＋ 已支持加成 ＝ ${move.damage ?? "待裁定"}`;
    notes.unshift(
      "未加本次出招的条件加伤，也未扣目标防御、格挡；特殊伤害和气血流失另看招式效果。",
      `属性项${rules?.rounding === "terms" ? "逐项" : "合计"}向下取整；有待裁定项时以提示为准。`,
    );
  } else if (kind === "critical") {
    formula =
      move.critical === null
        ? "此招不提供普通暴击伤害"
        : `基础伤害 ${move.damage} × 2 ＝ ${move.critical}`;
    rows = [];
    notes.unshift(
      "只有符合招式及命中规则的暴击才使用此值；条件加伤未计入，目标防御与格挡也未扣除。",
    );
  } else if (kind === "cost") {
    formula = "原始消耗 ＋ 升级变化 ＋ 已支持的消耗修正";
    rows = [
      { label: "原始内力", value: f?.mp ?? "未列" },
      {
        label: `升级 ${move.rank - 1} 次的内力变化`,
        value: (f?.mpUpgrade ?? 0) * (move.rank - 1),
      },
      { label: "当前内力消耗", value: move.mpCost ?? "待核对" },
      { label: "当前怒气消耗", value: move.rageCost },
    ];
    if (/%|％/.test(e?.costText??"")) {
      formula="资源上限 × 原文百分比（含阶段变化）";
      rows=[{label:"原文消耗",value:e?.costText??"待核对"},{label:"当前阶段内力消耗",value:move.mpCost??"取整待裁定"}];
    } else if (f)
      rows.splice(2, 0, {
        label: "内功、装备等修正（合计，消耗最低0）",
        value: move.mpCost === null ? "待核对" : move.mpCost - (f.mp + (f.mpUpgrade ?? 0) * (move.rank - 1)),
      });
    notes.unshift(
      `原文消耗：${e?.costText ?? "未列"}。百分比消耗、道具与条件投入须按招式原文处理。`,
      "查看招式不会自动扣资源。",
    );
  } else {
    formula = `架招 ＋ 当前持握武器 ＋ 已支持的格挡加成 ＝ ${move.block}`;
    notes.unshift(
      "此数值是开启该架招后的基础格挡；额外层数和桌边状态由你手动处理。",
    );
  }
  return {
    title: `${move.name} · ${title}`,
    formula,
    rows,
    notes,
    source: e ? sourceLabel(e) : undefined,
  };
}

export function explainSkill(build: Build, name: string): Explanation {
  const c = calculateCharacter(build);
  const r = skillCheck(build, name);
  const key = Object.entries(STAT_NAMES).find(
    ([, label]) => label === r.entry?.grade,
  )?.[0];
  const base = key
    ? Math.floor(c.stats[key as keyof typeof c.stats] / 10)
    : ["武学内功", "物品鉴定", "江湖八卦", "角色实力"].includes(name)
      ? c.insight
      : 0;
  const level = c.skills[name] ?? 0;
  return {
    title: `${name}检定`,
    formula: `D20 ＋ 技能等级 ${level} ＋ 检定加值 ${r.value - level} ＝ D20＋${r.value}`,
    rows: [
      {
        label: key
          ? `${STAT_NAMES[key as keyof typeof STAT_NAMES]} ${c.stats[key as keyof typeof c.stats]} ÷ 10，向下取整`
          : base
            ? "悟性"
            : "基础等级",
        value: base,
      },
      { label: "背景、性格、修炼与其他技能等级加成", value: level - base },
      ...c.details
        .filter((m) => m.key === `skill:${name}`)
        .map((m) => ({ label: `其中：${m.label}`, value: m.value })),
    ],
    notes: [
      ...r.conditional,
      "技能等级与只加检定结果的加值分开计算。掷实体骰后与 DM 给出的难度比较。",
    ],
    source: r.entry ? sourceLabel(r.entry) : undefined,
  };
}
