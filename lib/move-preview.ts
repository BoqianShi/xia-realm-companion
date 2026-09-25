import { getEntry, weaponOf } from "./catalog.ts";
import { calculateCharacter, calculateMove, defaultRules } from "./rules.ts";
import {
  checkDamage,
  releaseModes,
  weaponRequirement,
  actionText,
} from "./move-semantics.ts";
import type { Build, Entry, Rulings } from "./types.ts";
export type PreviewContext = {
  mode?: string;
  noStance?: boolean;
  previousHit?: boolean;
  huajin?: number;
  dao?: number;
  spentRage?: number;
  targetRageLost?: number;
  spentLayers?: number;
  nineMoves?: boolean;
  extraDamage?: number;
  musicBonus?: boolean;
  targetDefense?: number;
  targetBlock?: number;
  poisonResist?: number;
};
export type ResultPart = {
  label: string;
  value: number | null;
  kind:
    | "damage"
    | "poison"
    | "mental"
    | "hpLoss"
    | "mpLoss"
    | "healing"
    | "buff";
  detail: string;
};
export function moveCosts(
  e: Entry,
  b: Build,
  rank: number,
  context: PreviewContext = {},
) {
  const c = calculateCharacter(b),
    m = calculateMove(b, e.id, rank, { ...defaultRules, rounding: "total" }),
    raw = (e.costText ?? "").replace(/\s/g, "");
  const costs: { label: string; value: number | null; detail: string }[] = [];
  if (/%|％/.test(raw)) {
    for (const part of raw.split(/[，,、]/)) {
      const pct = part.match(/(\d+)[%％]/);
      if (!pct) continue;
      const field = part.includes("气血") ? "气血" : "内力";
      let rate = Number(pct[1]);
      if (e.name === "灭世燃灯") rate += 10 * (rank - 1);
      const value = ((field === "气血" ? c.hpMax : c.mpMax) * rate) / 100;
      costs.push({
        label: field,
        value: Number.isInteger(value) ? value : null,
        detail: `${field}上限 ${field === "气血" ? c.hpMax : c.mpMax} × ${rate}%${Number.isInteger(value) ? "" : ` = ${value}；取整待裁定`}`,
      });
    }
  } else if (/^无$/.test(raw))
    costs.push({ label: "内力", value: 0, detail: "原文：无" });
  else if (/^(?:内力)?\d+(?:$|[，,])/.test(raw))
    costs.push({
      label: "内力",
      value: m.mpCost,
      detail: "基础消耗＋阶段变化＋已支持常驻修正",
    });
  else if (/所有内力/.test(raw))
    costs.push({
      label: "内力",
      value: null,
      detail: "消耗当前所有内力，请输入或现场核对",
    });
  else if (!raw)
    costs.push({
      label: "消耗",
      value: null,
      detail: "原书未单列消耗；不推定免费",
    });
  if (!costs.length && !m.rageCost)
    costs.push({ label: "消耗", value: null, detail: raw || "消耗待核对" });
  if (m.rageCost)
    costs.push({ label: "怒气", value: m.rageCost, detail: "当前阶段" });
  if (/怒气[Xx]|任意.*怒气/.test(raw))
    costs.push({
      label: "怒气投入",
      value: context.spentRage ?? null,
      detail: "本次手动选择",
    });
  // Book notation such as 箭矢*1 is an independent material cost, not part of MP.
  for (const part of raw.split(/[，,、]/)) {
    const material = part.match(/^(.+?)[*×xX](\d+)$/);
    if (material)
      costs.push({ label: material[1], value: Number(material[2]), detail: `原文消耗：${part}；数量手动记录` });
  }
  if (/层|佳肴|茶叶|消耗品|物品|“|”/.test(raw))
    costs.push({ label: "其他消耗", value: null, detail: raw });
  return costs;
}
export function previewMove(
  b: Build,
  id: string,
  rank: number,
  rules: Rulings = defaultRules,
  context: PreviewContext = {},
) {
  const e = getEntry(id);
  if (!e) throw new Error("招式资料不存在");
  const c = calculateCharacter(b),
    base = calculateMove(b, id, rank, rules),
    modes = releaseModes(e),
    mode = modes.find((m) => m.id === context.mode) ?? modes[0];
  const parts: ResultPart[] = [],
    details = [...base.details],
    conditions: string[] = [];
  const unresolved = [...base.warnings];
  if (!e.formula) unresolved.push("伤害公式待校对");
  const w = weaponRequirement(e, getEntry(b.activeWeapon));
  if (w) conditions.push(w);
  if (mode.trigger) conditions.push(mode.trigger);
  let damage = mode.auxiliary ? null : base.damage;
  for (const v of Object.values(context))
    if (typeof v === "number" && (!Number.isFinite(v) || v < 0 || v > 100000))
      throw new Error("条件投入须为0至100000之间的有限数值");
  const add = (label: string, value: number) => {
    details.push({ label, value });
    if (damage !== null) damage += value;
  };
  const inner = getEntry(b.activeInner),
    innerLevel = b.inner.find((l) => l.id === b.activeInner)?.level ?? 0;
  if (inner?.name === "背水诀" && innerLevel >= 2) {
    conditions.push("无架招时才获得背水诀增伤");
    if (context.noStance)
      add("背水诀 · 已确认本次无架招", innerLevel === 3 ? 20 : 10);
  }
  if (e.name === "阳重三叠") {
    const extra = 5 * rank;
    conditions.push(
      `目标本场曾被你此招造成伤害 → ＋${extra}（原始5＋升级${5 * (rank - 1)}）`,
    );
    if (context.previousHit) add("阳重三叠 · 已确认目标曾受此招伤害", extra);
  }
  if (context.huajin && inner?.name === "太极神功") {
    add(`投入${context.huajin}层化劲`, context.huajin * 10);
    conditions.push("化劲是否可用于本招由桌上确认；未扣除记录层数");
  }
  if (context.extraDamage) add("本次手动补充", context.extraDamage);
  if (e.name === "九印合一" && context.nineMoves) {
    const costs = moveCosts(e, b, rank, context);
    const hp = costs.find((x) => x.label === "气血")?.value,
      mp = costs.find((x) => x.label === "内力")?.value;
    if (hp != null && mp != null && Number.isInteger((hp+mp)/2))
      add("本场九招均已施展 · 消耗气血与内力之和的一半", (hp + mp) / 2);
    else unresolved.push("九招条件已确认，但消耗或增伤出现未裁定的小数，增伤待裁定");
  }
  if(e.name==='灭世燃灯'){
    const hp=moveCosts(e,b,rank,context).find(x=>x.label==='气血')?.value;
    const extra=hp!=null&&Number.isInteger(hp/2)?hp/2:null;
    parts.push({label:'下一次招式增伤',kind:'buff',value:extra,detail:'消耗气血的一半；本次不会直接造成这部分伤害，也不扣除气血'});
    if(extra===null)unresolved.push('消耗气血或其一半出现小数，下一招增伤的取整待裁定');
  }
  if (e.name === "万法如一") {
    const lost = context.targetRageLost;
    const coefficient = 10 + 5 * (rank - 1);
    const value = lost === undefined ? null : lost * coefficient;
    const detail = `所有目标实际失去怒气之和 × ${coefficient}（基础10＋升级${5 * (rank - 1)}）；由桌上核对每个目标的现有怒气，不能直接用你的投入代替`;
    parts.push({ label: "周围敌人气血流失", kind: "hpLoss", value, detail });
    parts.push({ label: "自身回复气血", kind: "healing", value, detail });
    if (lost === undefined) unresolved.push("请提供所有目标实际失去的怒气总数，才能计算气血流失与回复");
  }
  const attackRoll =
    !checkDamage(e) &&
    e.moveType !== "反击" &&
    !mode.auxiliary &&
    base.damageType !== "none";
  const canCritical =
    attackRoll && ["physical", "internal"].includes(base.damageType);
  const doubles =
    canCritical && (mode.action !== "reaction" || inner?.name === "五绝神典");
  const critical = damage === null || !doubles ? null : damage * 2;
  if (damage !== null && base.damageType !== "none")
    parts.push({
      label: "招式伤害",
      value: damage,
      kind: "damage",
      detail:
        mode.action === "reaction"
          ? "反应施展：可触发暴击条件，通常不翻倍"
          : "尚未扣除目标防御、格挡与护体",
    });
  if (mode.auxiliary)
    parts.push({
      label: "增益",
      value: null,
      kind: "buff",
      detail: mode.effect ?? "",
    });
  if (inner?.name === "化功秘法" && innerLevel >= 2 && (attackRoll || e.moveType === "反击") && base.damageType !== "none") {
    const poison = innerLevel === 3 ? 20 : 10;
    parts.push({
      label: "化功秘法 · 毒伤",
      value: poison,
      kind: "poison",
      detail: "招式命中后触发；与招式傷害分开，韧性等抵抗另算，不翻倍",
    });
    parts.push({
      label: "化功秘法 · 内力流失",
      value: 5,
      kind: "mpLoss",
      detail: "招式命中后触发；流失不属于伤害",
    });
  }
  if (context.dao && e.name === "无我无道")
    parts.push({
      label: "投入道 · 精神伤害",
      value: context.dao * c.insight,
      kind: "mental",
      detail: "道层数 × 悟性，不随暴击翻倍；需确认本招允许投入",
    });
  if (e.music && e.name === "清商")
    parts.push({
      label: "友方回复内力",
      value: context.musicBonus ? 20 : 10,
      kind: "healing",
      detail: context.musicBonus
        ? "演奏前商、商已确认：基础10＋天籁10"
        : "基础10；演奏前满足商、商额外10",
    });
  if (
    ["physical", "internal"].includes(base.damageType) &&
    (context.targetDefense !== undefined || context.targetBlock !== undefined)
  ) {
    const reduction = (context.targetDefense ?? 0) + (context.targetBlock ?? 0);
    parts.push({
      label: "扣防后参考",
      kind: "damage",
      value: damage === null ? null : Math.max(0, damage - reduction),
      detail: `招式伤害 − 防御${context.targetDefense ?? 0} − 格挡${context.targetBlock ?? 0}；尚未处理护体及其他效果`,
    });
    if (critical !== null)
      parts.push({
        label: "暴击扣防后参考",
        kind: "damage",
        value: Math.max(0, critical - reduction),
        detail: "仅适用暴击分支",
      });
  }
  const usedWeapon = weaponOf(e) || (/任意武器/.test(e.requirement ?? "") ? getEntry(b.activeWeapon)?.weapon ?? "徒手" : ""),
    attackLabel = base.damageType === "physical" ? "外功" : "内功",
    hit = base.damageType === "physical" ? c.physicalHit : c.internalHit;
  const dice =
    e.moveType === "反击"
      ? "看破针对自身架招的虚招后反击：必定命中，不能暴击"
      : checkDamage(e)
        ? "目标进行原文指定检定；失败受伤，无需命中，不会暴击"
        : attackRoll
          ? `命中 D20＋${hit}（${attackLabel}命中） ≥ 目标闪避${(c.weaponSkills[usedWeapon] ?? 0) === 0 ? "；武器技能0，命中劣势" : ""}`
          : "按效果说明进行检定";
  const feint =
    e.moveType === "虚招"
      ? `先命中；有架招时对抗：D20＋${(c.weaponSkills[usedWeapon] ?? 0) + rank * (e.grade === "天级" ? 4 : e.grade === "地级" ? 3 : e.grade === "人级" ? 2 : 0) + c.details.filter((d) => d.key === "feint").reduce((s, d) => s + d.value, 0)}；对方 D20＋武学内功＋其他加值。平局虚招方胜。`
      : undefined;
  const costs = moveCosts(e, b, rank, context);
  for (const cost of costs) if (cost.value === null) unresolved.push(`${cost.label}：${cost.detail}`);
  return {
    base,
    damage,
    critical,
    canCritical,
    doubles,
    modes,
    mode,
    action: actionText(mode),
    dice,
    feint,
    costs,
    parts,
    details,
    conditions,
    unresolved,
    status: unresolved.length ? ("partial" as const) : ("calculated" as const),
    source: e.source,
  };
}
