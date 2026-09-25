import { releaseModes, checkDamage } from "./move-semantics.ts";
import {
  getEntry,
  effectiveMoves,
  inventoryIssues,
  maxRank,
  weaponOf,
  weapons,
} from "./catalog.ts";
import type {
  ActionInput,
  ActionResult,
  Build,
  Campaign,
  CharacterResult,
  EffectModifier,
  Entry,
  Modifier,
  MoveResult,
  Rulings,
  Runtime,
  StatKey,
  TargetResult,
} from "./types.ts";
import { RULES_VERSION, STAT_KEYS, STAT_NAMES } from "./types.ts";
export const blankStats = () => ({
  strength: 0,
  agility: 0,
  body: 0,
  breath: 0,
  qi: 0,
  spirit: 0,
});
export const defaultRules: Rulings = {
  rounding: "unset",
  fixedDamage: "unset",
  weaponSkill: "tier",
  allowExpansion: true,
  allowedIds: [],
  blockedIds: [],
};
export function emptyBuild(): Build {
  return {
    name: "",
    kind: "pc",
    sect: "",
    background: "",
    personality: "",
    personalityChoices: [],
    freeAttributes: blankStats(),
    base: { strength: 1, agility: 1, body: 1, breath: 1, qi: 1, spirit: 1 },
    insightBase: 1,
    skillChoices: {},
    inner: [],
    activeInner: "",
    moves: [],
    equipment: [],
    activeWeapon: "",
    meridians: [],
    traits: [],
    bonuses: [],
    xp: 0,
    silver: 0,
    notes: "",
    favorites: [],
    rulesVersion: RULES_VERSION,
  };
}
export function emptyRuntime(b: Build): Runtime {
  const c = calculateCharacter(b);
  return {
    hp: c.hpMax,
    mp: c.mpMax,
    rage: 0,
    shield: 0,
    stance: "",
    conditions: [],
    history: {},
    main: true,
    minor: true,
    reaction: true,
    usedRoutine: "",
  };
}
export const stack = (r: Runtime | undefined, n: string) =>
  r?.conditions.filter((x) => x.name === n).reduce((s, x) => s + x.stacks, 0) ??
  0;
export const has = (r: Runtime | undefined, n: string) => stack(r, n) > 0;
export function activeInner(b: Build) {
  const learned = b.inner.find((x) => x.id === b.activeInner);
  return {
    entry: learned ? getEntry(learned.id) : undefined,
    level: learned?.level ?? 0,
  };
}
const groups: Record<StatKey, string[]> = {
  strength: ["角力", "挣脱", "抛掷", "擒抱"],
  agility: ["潜行", "巧手", "轻功", "马术"],
  body: ["韧性", "闭气", "忍耐", "凝血"],
  breath: ["疗伤", "冲穴", "敛息", "渡气"],
  qi: ["点穴", "追踪", "探查", "洞察"],
  spirit: ["交易", "欺瞒", "说服", "定力"],
};
export function activeEffect(b: Build) {
  const { entry, level } = activeInner(b);
  if (!entry) return "";
  return (
    entry.effects?.[String(level)] ??
    entry.effects?.[String(level - 1)] ??
    entry.effects?.["1"] ??
    ""
  );
}
export function effectModifiers(
  b: Build,
  r?: Runtime,
  move?: Entry,
  rank = 1,
  calc?: CharacterResult,
): Modifier[] {
  const active = activeInner(b);
  const mods: EffectModifier[] = [];
  if (!has(r, "丹田破碎") && active.entry) {
    const levels = active.entry.activeModifiers ?? {};
    mods.push(
      ...(levels[String(active.level)] ??
        levels[String(active.level - 1)] ??
        levels["1"] ??
        []),
    );
  }
  for (const id of new Set(b.equipment)) {
    const e = getEntry(id);
    if (
      !e ||
      (e.slot === "武器" && id !== b.activeWeapon) ||
      (e.slot !== "武器" && has(r, "破衣"))
    )
      continue;
    mods.push(...(e.effectModifiers ?? []));
  }
  for (const l of b.moves) {
    const e = getEntry(l.id);
    if (e?.lightness) mods.push(...(e.effectModifiers ?? []));
  }
  return mods
    .filter((m) => {
      const w = m.when ?? {};
      const panel = !!(
        w.affinity ||
        w.weapon ||
        w.damageType ||
        w.rankAtLeast ||
        m.perSkill ||
        m.perName
      );
      if (!!move !== panel) return false;
      if (
        (w.innerAffinity && active.entry?.affinity !== w.innerAffinity) ||
        (w.condition && !has(r, w.condition)) ||
        (w.noStance && (!r || !!r.stance))
      )
        return false;
      if (
        move &&
        ((w.affinity && !w.affinity.includes(move.affinity ?? "")) ||
          (w.weapon && weaponOf(move) !== w.weapon) ||
          (w.damageType && move.formula?.damageType !== w.damageType) ||
          (w.rankAtLeast && rank < w.rankAtLeast))
      )
        return false;
      return true;
    })
    .map((m) => ({
      ...m,
      value:
        m.value *
        (m.perStack
          ? stack(r, m.perStack)
          : m.perName
            ? [...(move?.name ?? "")].length
            : m.perSkill
              ? (calc?.skills[m.perSkill] ?? 0)
              : 1),
    }));
}
export function calculateCharacter(b: Build, r?: Runtime): CharacterResult {
  const details: Modifier[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const append = (ms: Modifier[] | undefined) => details.push(...(ms ?? []));
  for (const k of STAT_KEYS)
    details.push({
      key: k,
      value: b.base[k] + (b.freeAttributes?.[k] ?? 0),
      label: "基础与自由属性",
    });
  const active = activeInner(b);
  if (active.entry && !has(r, "丹田破碎")) {
    const stage = active.entry.stages?.find((x) => x.stage === active.level);
    if (!stage)
      warnings.push(
        `${active.entry.name}缺少第 ${active.level} 阶段属性，不能完整计算。`,
      );
    else
      for (const k of STAT_KEYS)
        details.push({
          key: k,
          value: stage.stats[k],
          label: `${active.entry.name} · 运行第 ${active.level} 阶`,
        });
    warnings.push(
      ...(active.entry.unresolvedStatic?.[String(active.level)] ?? []).map(
        (t) => active.entry!.name + "：" + t,
      ),
    );
  }
  append(effectModifiers(b, r));
  for (const x of b.inner) {
    const e = getEntry(x.id);
    if (!e || seen.has(x.id)) continue;
    seen.add(x.id);
    if (x.level === maxRank(e) && e.permanent) {
      append(e.modifiers);
      warnings.push(
        ...(e.permanentUnresolved ?? []).map(
          (t) => e.name + " · 修满永久：" + t,
        ),
      );
    }
  }
  for (const id of new Set([
    b.background,
    ...b.meridians,
    ...b.equipment,
    ...b.traits,
  ])) {
    const e = getEntry(id);
    if (!e) continue;
    if (e.kind === "equipment" && e.slot === "武器" && id !== b.activeWeapon)
      continue;
    if (e.kind === "equipment" && has(r, "破衣") && e.slot !== "武器") continue;
    if (e.kind !== "equipment") append(e.modifiers);
    if (e.kind === "equipment")
      warnings.push(
        ...(e.unresolvedEffects ?? []).map((t) => e.name + "：" + t),
      );
  }
  for (const x of b.moves.filter(l => !getEntry(l.id)?.grantedBy)) {
    const e = getEntry(x.id);
    append(e?.modifiers);
    if (e?.lightness)
      warnings.push(
        ...(e.unresolvedEffects ?? []).map((t) => e.name + "：" + t),
      );
  }
  append(b.bonuses);
  if (b.traits.includes("玄关"))
    append([
      { key: "hpMax", value: 100, label: "生死玄关" },
      { key: "mpMax", value: 100, label: "生死玄关" },
      { key: "block", value: 100, label: "生死玄关" },
      { key: "feint", value: 3, label: "生死玄关" },
      { key: "lookThrough", value: 3, label: "生死玄关" },
    ]);
  const add = (key: string, value: number, label: string) =>
    details.push({ key, value, label });
  const statusMods: Record<string, Record<string, number>> = {
    乘风: { speed: 1 },
    磐石: { block: 5 },
    护身: { physicalDefense: 5, internalDefense: 5 },
    蓄劲: { physicalCrit: -1, internalCrit: -1 },
    犹豫: { physicalCrit: 1, internalCrit: 1 },
    失准: { physicalHit: -5, internalHit: -5 },
    眼力: { physicalHit: 5, internalHit: 5 },
    轻灵: { dodge: 5 },
    笨拙: { dodge: -5 },
    劲力: { flatDamage: 5 },
    劲气: { flatDamage: 10 },
    乏力: { flatDamage: -10 },
    饥饿: { body: -1 },
    愚钝: { feint: -1 },
    霸王: { physicalDefense: 5, internalDefense: 5, flatDamage: 5 },
  };
  for (const [n, ms] of Object.entries(statusMods))
    for (const [k, v] of Object.entries(ms))
      if (stack(r, n)) add(k, v * stack(r, n), `${n} × ${stack(r, n)}`);
  if (has(r, "错骨")) add("lookThrough", -5, "错骨");
  if (has(r, "脱力")) add("feint", -3, "脱力");
  if (has(r, "士气")) {
    add("physicalCrit", -Math.floor(stack(r, "士气") / 10), "士气");
    add("internalCrit", -Math.floor(stack(r, "士气") / 10), "士气");
    add("flatDamage", stack(r, "士气"), "士气（下次出招）");
  }
  const sum = (k: string) =>
    details.filter((x) => x.key === k).reduce((a, x) => a + x.value, 0);
  const stats = blankStats();
  for (const k of STAT_KEYS) stats[k] = sum(k);
  let realm = 0;
  for (const l of b.inner) {
    const e = getEntry(l.id);
    if (e)
      realm = Math.max(
        realm,
        l.level + (e.grade === "天级" ? 4 : e.grade === "地级" ? 2 : 0),
      );
  }
  if (has(r, "丹田破碎")) realm = 1;
  const learned = b.moves.filter(l => !getEntry(l.id)?.grantedBy)
    .map((l) => ({ e: getEntry(l.id), level: l.level }))
    .filter((x) => x.e);
  const moveInsight =
    Math.min(
      10,
      learned.filter(
        (x) =>
          x.level >= 3 &&
          x.e!.grade === "人级" &&
          !x.e!.lightness &&
          weaponOf(x.e),
      ).length,
    ) +
    Math.min(
      10,
      learned.filter(
        (x) =>
          x.level >= 3 &&
          x.e!.grade === "地级" &&
          !x.e!.lightness &&
          weaponOf(x.e),
      ).length,
    ) +
    learned
      .filter((x) => x.e!.grade === "天级" && !x.e!.lightness && weaponOf(x.e))
      .reduce((s, x) => s + Math.max(0, x.level - 2), 0);
  if(learned.some(x=>x.e!.name==="金刚力"&&x.level>=2)){
    add("physicalDefense",5,"金刚力 · 下部永久");add("internalDefense",5,"金刚力 · 下部永久");
  }
  const insight =
    Math.min(
      b.traits.includes("玄关") ? 40 : 30,
      b.insightBase + realm + moveInsight,
    ) + sum("insight");
  const skills: Record<string, number> = {};
  for (const k of STAT_KEYS)
    for (const skill of groups[k]) skills[skill] = Math.floor(stats[k] / 10);
  for (const s of ["武学内功", "物品鉴定", "江湖八卦", "角色实力"])
    skills[s] = insight;
  for (const [k, v] of Object.entries(
    getEntry(b.background)?.skillBonuses ?? {},
  ))
    if (!k.includes("任选")) skills[k] = (skills[k] ?? 0) + v;
  if (getEntry(b.background)?.name === "小贩" && b.backgroundSkillChoice)
    skills[b.backgroundSkillChoice] =
      (skills[b.backgroundSkillChoice] ?? 0) + 1;
  for (const k of b.personalityChoices ?? []) skills[k] = (skills[k] ?? 0) + 2;
  for (const [k, v] of Object.entries(b.skillChoices))
    skills[k] = (skills[k] ?? 0) + v;
  for (const m of details.filter((x) => x.key.startsWith("skill:"))) {
    const k = m.key.slice(6);
    skills[k] = (skills[k] ?? 0) + m.value;
  }
  const weaponSkills: Record<string, number> = {};
  for (const w of weapons) {
    const ms = learned.filter((x) => weaponOf(x.e) === w);
    weaponSkills[w] =
      Math.min(
        4,
        ms.filter((x) => x.level >= 2).length +
          (getEntry(b.background)?.weaponBonus?.[w] ?? 0),
      ) +
      Math.min(
        4,
        ms.filter((x) => x.level >= 3 && x.e!.grade !== "人级").length,
      ) +
      ms.filter((x) => x.level >= 4 && x.e!.grade === "天级").length +
      sum("weapon:" + w);
  }
  const weapon = getEntry(b.activeWeapon);
  const weaponDamage = weapon?.weaponDamage ?? 0;
  const weaponBlock = weapon?.weaponBlock ?? 0;
  if (active.entry?.name === "无生老母经" && active.level >= 2) {
    add("flatDamage", Math.floor(insight / 2), "无生老母经 · 悟性");
    if (active.level === 3)
      add("block", Math.floor(insight / 2), "无生老母经 · 悟性");
  }
  if (active.entry?.name === "五绝神典" && active.level === 3) {
    const gain = learned
      .filter((x) => x.level >= 3)
      .reduce(
        (n, x) =>
          n + (x.e!.grade === "天级" ? 15 : x.e!.grade === "地级" ? 10 : 5),
        0,
      );
    add("hpMax", gain, "五绝神典 · 精通招式");
    add("mpMax", gain, "五绝神典 · 精通招式");
  }
  const result: CharacterResult = {
    stats,
    insight,
    realm,
    skills,
    weaponSkills,
    hpMax: Math.max(
      1,
      Math.floor(stats.body * 4 + stats.strength + sum("hpMax")),
    ),
    mpMax: Math.max(0, Math.floor(stats.breath + sum("mpMax"))),
    speed: Math.floor(5 + (skills["轻功"] ?? 0) / 2) + sum("speed"),
    dodge: 10 + Math.floor(stats.agility / 4) + sum("dodge"),
    initiative: Math.floor(stats.agility / 10) + sum("initiative"),
    physicalDefense: Math.floor(stats.body / 5) + sum("physicalDefense"),
    internalDefense: Math.floor(stats.breath / 3) + sum("internalDefense"),
    physicalHit: Math.floor(stats.agility / 2) + sum("physicalHit"),
    internalHit: Math.floor(stats.qi / 2) + sum("internalHit"),
    physicalCrit: 20 - Math.floor(stats.strength / 20) + sum("physicalCrit"),
    internalCrit: 20 - Math.floor(stats.qi / 20) + sum("internalCrit"),
    lookThrough: (skills["武学内功"] ?? 0) + sum("lookThrough"),
    weaponDamage,
    weaponBlock,
    block: sum("block"),
    affinity: has(r, "丹田破碎") ? "" : (active.entry?.affinity ?? ""),
    flatDamage: sum("flatDamage"),
    coefficientBonus: sum("coefficientBonus"),
    details,
    warnings,
  };
  if (r?.stance) {
    const stance = getEntry(r.stance);
    const level = b.moves.find((x) => x.id === r.stance)?.level ?? 1;
    result.block +=
      weaponBlock +
      (stance?.formula?.block ?? 0) +
      (stance?.formula?.blockUpgrade ?? 0) * (level - 1) +
      stack(r, "墨舞") * 5;
  } else result.block = 0;
  if (r?.stance) {
    const stance = getEntry(r.stance);
    if (stance)
      result.block += effectModifiers(
        b,
        r,
        stance,
        b.moves.find((l) => l.id === stance.id)?.level ?? 1,
        result,
      )
        .filter((m) => m.key === "block")
        .reduce((n, m) => n + m.value, 0);
  }
  if (has(r, "破甲")) result.physicalDefense = 0;
  if (
    has(r, "禁足") ||
    has(r, "定身") ||
    has(r, "点穴") ||
    has(r, "眩晕") ||
    r?.hp === 0
  ) {
    result.dodge = 0;
    result.speed = 0;
  }
  if (has(r, "下盘不稳") || has(r, "剧痛"))
    result.speed = Math.floor(result.speed / 2);
  if (has(r, "失血"))
    result.hpMax = Math.max(
      0,
      Math.floor(result.hpMax * (1 - 0.1 * stack(r, "失血"))),
    );
  return result;
}
export function affinityBonus(inner: string, move: string) {
  if (!inner || !move) return 0;
  if (
    inner === move ||
    (inner === "阴柔" && ["阴", "柔"].includes(move)) ||
    (inner === "阳刚" && ["阳", "刚"].includes(move))
  )
    return 0.2;
  if (inner === "太极" || move === "太极") return 0.1;
  return 0;
}
export function weaponBonus(level: number, rules: Rulings) {
  return rules.weaponSkill === "progressive"
    ? Math.min(4, level) +
        Math.max(0, Math.min(4, level - 4)) * 2 +
        Math.max(0, level - 8) * 3
    : level * (level <= 4 ? 1 : level <= 8 ? 2 : 3);
}
export function calculateMove(
  b: Build,
  id: string,
  level?: number,
  rules: Rulings = defaultRules,
  r?: Runtime,
): MoveResult {
  const e = getEntry(id);
  const rank = level ?? effectiveMoves(b).find((x) => x.id === id)?.level ?? 1;
  const c = calculateCharacter(b, r);
  const f = e?.formula;
  const result: MoveResult = {
    id,
    name: e?.name ?? "未知招式",
    type: e?.moveType ?? "被动",
    weapon: weaponOf(e),
    damageType: f?.damageType ?? "none",
    damage: null,
    critical: null,
    mpCost: Math.max(0, (f?.mp ?? 0) + (f?.mpUpgrade ?? 0) * (rank - 1)),
    rageCost: Math.max(0, (f?.rage ?? 0) + (f?.rageUpgrade ?? 0) * (rank - 1)),
    block: (f?.block ?? 0) + (f?.blockUpgrade ?? 0) * (rank - 1),
    distance:
      (f?.distance ?? 0) +
      (f?.distanceUpgrade ?? 0) * (rank - 1) +
      stack(r, "延展"),
    action: e ? releaseModes(e)[0].action : "main",
    terms: f?.terms ?? [],
    details: [],
    warnings: [],
    effects: [],
    rank,
  };
  if (!e || !f) {
    result.warnings.push("本条目尚无可用结算公式，请查阅原文并由 DM 处理。");
    return result;
  }
  if (e.moveType === "架招") {
    const stanceBuild = {
      ...b,
      moves: [...b.moves.filter((move) => move.id !== id), { id, level: rank }],
    };
    result.block = calculateCharacter(stanceBuild, {
      ...(r ?? emptyRuntime(b)),
      stance: id,
    }).block;
    result.details.push({
      label: "开启此架招后格挡（含持握武器与已支持加成）",
      value: result.block,
    });
  }
  const inner = activeInner(b);
  let moveAffinity = e.affinity ?? "";
  if (inner.entry?.name === "九霄神鹤功" && f.damageType === "internal")
    moveAffinity = "阳";
  if (
    inner.entry?.name === "传道功" &&
    (c.weaponSkills[result.weapon] ?? 0) >= 8
  )
    moveAffinity = "太极";
  const bonus = affinityBonus(c.affinity, moveAffinity) + c.coefficientBonus;
  const panelModifiers = effectModifiers(b, r, e, rank, c);
  for (const mod of panelModifiers) {
    if (mod.key === "mpCost")
      result.mpCost = Math.max(0, (result.mpCost ?? 0) + mod.value);
    if (mod.key === "distance")
      result.distance = Math.max(0, result.distance + mod.value);
  }
  result.mpCost = Math.max(
    0,
    (result.mpCost ?? 0) +
      c.details
        .filter((x) => x.key === "mpCost")
        .reduce((n, m) => n + m.value, 0),
  );
  result.distance += c.details
    .filter((x) => x.key === "distance")
    .reduce((n, m) => n + m.value, 0);
  result.warnings.push(...c.warnings.map((t) => "常驻/条件效果待核对：" + t));
  const terms = f.terms.map(
    (t) =>
      Math.round((t.coefficient + bonus) * c.stats[t.stat] * 100000) / 100000,
  );
  const special = !["physical", "internal", "none"].includes(f.damageType);
  if (terms.length) {
    f.terms.forEach((t, i) =>
      result.details.push({
        label: `${STAT_NAMES[t.stat]} ${c.stats[t.stat]} × (${t.coefficient}${bonus ? " + " + Math.round(bonus * 10) / 10 : ""})`,
        value: terms[i],
      }),
    );
    const allFloor = Math.floor(terms.reduce((s, n) => s + n, 0) + 1e-8);
    const termFloor = terms.reduce((s, n) => s + Math.floor(n + 1e-8), 0);
    if (allFloor !== termFloor && rules.rounding === "unset")
      result.warnings.push(
        `待裁定取整：合计取整 ${allFloor}，逐项取整 ${termFloor}。请在团规选择。`,
      );
    else result.damage = rules.rounding === "terms" ? termFloor : allFloor;
  } else if (f.fixed !== null) {
    if (rules.fixedDamage === "unset")
      result.warnings.push(
        "固定数值伤害是否叠加武器与技能尚未裁定，请在团规选择。",
      );
    else result.damage = f.fixed;
    result.details.push({ label: "原文固定伤害", value: f.fixed });
  } else if (
    ((e.moveType === "架招" || e.moveType === "气招" || e.music) && f.damageType === "none") ||
    e.id === "expansion-move-96ee14188dc5"
  ) {
    result.damage = 0;
  } else
    result.warnings.push(
      "原文包含可变值、技能或多段伤害，尚需 DM 核对公式；不会当作零伤害自动结算。",
    );
  const add = (label: string, value: number) => {
    if (!value) return;
    result.details.push({ label, value });
    if (result.damage !== null) result.damage += value;
  };
  if (f.damageType !== "none") {
    if (e.parentId === "expansion-routine-d81524858dfa")
      add("翰林笔法 · 书写等级 × 2", (c.skills["书写"] ?? 0) * 2);
    add(`掌握阶段 ${rank} · 伤害成长`, f.damageUpgrade * (rank - 1));
    if (!special && (f.fixed === null || rules.fixedDamage === "bonuses")) {
      const w = getEntry(b.activeWeapon);
      if (!w || weaponOf(e) === w.weapon) add("当前武器", w?.weaponDamage ?? 0);
      add(
        `${result.weapon || "武器"}技能`,
        weaponBonus(c.weaponSkills[result.weapon] ?? 0, rules),
      );
      add("常驻与状态加成", c.flatDamage);
      for (const mod of panelModifiers.filter((x) => x.key === "flatDamage"))
        add(mod.label, mod.value);
      if (inner.entry?.name === "九霄神鹤功" && f.damageType === "internal")
        add(
          "九霄神鹤功 · 内功招式",
          inner.level === 3 ? 20 : inner.level === 2 ? 15 : 10,
        );
      if (
        inner.entry?.name === "传道功" &&
        (c.weaponSkills[result.weapon] ?? 0) >= 8
      )
        add("传道功 · 武器技能至少8", 5);

      if (inner.entry?.name === "心寂诀")
        add("心寂诀 · 本招怒气投入", result.rageCost * inner.level * 5);
      if (e.name === "墨点江山") add("当前格挡转为招式伤害", c.block);
      if (e.affinity === "刚") add("刚劲", stack(r, "刚劲") * 5);
      if (e.affinity === "柔") add("绵劲", stack(r, "绵劲") * 5);
      if (
        b.meridians.some((id) => getEntry(id)?.name === "阳维脉") &&
        ["阳", "刚"].includes(e.affinity ?? "")
      )
        add("阳维脉", 20);
      if (
        b.meridians.some((id) => getEntry(id)?.name === "阴维脉") &&
        ["阴", "柔"].includes(e.affinity ?? "")
      )
        add("阴维脉", 20);
    }
  }
  if (result.damage !== null) {
    result.damage = Math.max(0, Math.floor(result.damage));
    const reactionCrit = activeInner(b).entry?.name === "五绝神典";
    result.critical =
      f.damageType === "none" ||
      special ||
      e.moveType === "反击" ||
      checkDamage(e) ||
      (result.action === "reaction" && !reactionCrit)
        ? null
        : result.damage * 2;
  }
  const body = e.text.split(/升级[:：]/)[0];
  result.effects = [body];
  // Explicitly retain conditional clauses instead of pretending the base formula resolves the entire move.
  const effectLines = body
    .replace(/\s/g, "")
    .split(/[。；]/)
    .filter((t) =>
      /击飞|击退|倒地|状态|获得|回复|移除|流失|重复|再|若|持续|暴击|每|当|可以|吸血|无视|反弹/.test(
        t,
      ),
    );
  const known = ["悬梁刺股", "阳重三叠", "金鸡独立", "笔诛墨罚", "墨点江山"];
  if (effectLines.length && !known.includes(e.name))
    result.warnings.push(...effectLines.map((x) => "效果待处理：" + x));
  if (
    e.upgrade &&
    !/^(招式伤害[+\-]\d+[，、]?|内力消耗[+\-]\d+[，、]?|怒气消耗[+\-]\d+[，、]?|格挡值[+\-]\d+[，、]?|。|\s)+$/.test(
      e.upgrade,
    )
  )
    result.warnings.push("阶段附加效果请核对：" + e.upgrade.replace(/\s/g, ""));
  if (result.weapon && result.weapon !== "徒手" && !b.activeWeapon)
    result.warnings.push(
      "尚未持握所需武器：" + (e.requirement ?? result.weapon),
    );
  if (e.id === "expansion-move-96ee14188dc5") result.distance = 3 + (rank - 1);
  if (
    e.music &&
    /失败则受到/.test(e.music.baseEffect) &&
    !/成功则.*受到伤害/.test(e.music.baseEffect)
  )
    result.critical = null;
  if (e.music && /%|％/.test(e.costText ?? ""))
    result.warnings.push(
      "本招按内力上限百分比消耗；请按原文与团规核对，不能视作免费。",
    );
  if (/%|％/.test(e.costText ?? '')) {
    const mpPart=(e.costText??'').split(/[，,、]/).find(part=>part.includes('内力'));
    const pct=mpPart?.match(/(\d+)[%％]/);
    const raw=pct ? c.mpMax*Number(pct[1])/100 : 0;
    result.mpCost=Number.isInteger(raw)?raw:null;
    if(result.mpCost===null)result.warnings.push('内力上限百分比消耗出现小数，取整尚待裁定');
  } else if (!/^(?:(?:内力)?\d+|无|怒气\d+)(?:$|[，,])/.test((e.costText??'').replace(/\s/g,''))) {
    result.mpCost=null;
    result.warnings.push('消耗包含当前资源或其他条件，请查看消耗分项；不推定免费');
  }
  return result;
}
export function allowed(e: Entry, rules: Rulings) {
  return (
    !rules.blockedIds.includes(e.id) &&
    !(e.parentId && rules.blockedIds.includes(e.parentId)) &&
    (!rules.allowedIds.length ||
      rules.allowedIds.includes(e.id) ||
      (!!e.parentId && rules.allowedIds.includes(e.parentId))) &&
    (rules.allowExpansion || e.source.book === "core")
  );
}
export function learningIssues(
  b: Build,
  e: Entry,
  rules: Rulings,
  skipInsight = false,
): string[] {
  const out: string[] = [];
  if (e.kind === "meridian") {
    const selected = b.meridians.map((id) => getEntry(id)).filter(Boolean);
    const gate =
      e.grade === "第二关" ? "第一关" : e.grade === "第三关" ? "第二关" : "";
    if (gate && !selected.some((x) => x!.grade === gate))
      out.push(`需要先打通至少一条${gate}经脉。`);
    if (e.grade !== "奇经八脉") {
      const grade =
        e.grade === "第一关" ? "人级" : e.grade === "第二关" ? "地级" : "天级";
      const yin = /阴/.test(e.name);
      const completed = b.inner.filter(
        (x) =>
          getEntry(x.id)?.grade === grade &&
          x.level === 3 &&
          ["太极", yin ? "阴柔" : "阳刚"].includes(
            getEntry(x.id)?.affinity ?? "",
          ),
      );
      if (!completed.length)
        out.push(
          `需要一门圆满的${grade}${yin ? "阴柔" : "阳刚"}或太极内功，并完成经脉检定。`,
        );
    } else {
      const yin = selected.filter(
        (x) => /阴/.test(x!.name) && x!.grade !== "奇经八脉",
      ).length;
      const yang = selected.filter(
        (x) => /阳/.test(x!.name) && x!.grade !== "奇经八脉",
      ).length;
      if (e.name === "任脉" && yin < 6) out.push("需要打通六条阴脉。");
      if (e.name === "督脉" && yang < 6) out.push("需要打通六条阳脉。");
      if (
        e.name === "带脉" &&
        selected.filter((x) => ["第一关", "第二关"].includes(x!.grade)).length <
          8
      )
        out.push("需要打通第一、第二关全部经脉。");
      if (e.name === "冲脉" && !b.traits.includes("玄关"))
        out.push("需要突破生死玄关。");
      if (["阴跷脉", "阳跷脉"].includes(e.name)) {
        const polarity=e.name.startsWith("阴")?"阴":"阳";
        if(!["第一关","第二关","第三关"].every(g=>selected.some(x=>x!.grade===g&&x!.name.includes(polarity))))out.push(`需要每一关各一条${polarity}脉。`);
      }
      if(e.name === "冲脉" && !["第一关","第二关","第三关"].every(g=>selected.some(x=>x!.grade===g)))out.push("需要每关各一条经脉。");
      if(e.name === "阴维脉" && yin<4)out.push("需要四条阴脉。");
      if(e.name === "阳维脉" && yang<4)out.push("需要四条阳脉。");
      if (["阴维脉", "阳维脉"].includes(e.name))
        out.push("对应四个穴位服食奇珍的记录须由 DM 核对。");
    }
  }
  if (e.learnable === false || e.kind === "reference") out.push(e.grantedBy?`随《${getEntry(e.grantedBy)?.name}》学习，不独立花费修为。`:"这是参考资料，不能作为正式功法学习。");
  if (!allowed(e, rules)) out.push("本团暂未开放，仍可浏览和试配。");
  const min = e.lightness
    ? 0
    : (e.insight ??
      (e.kind === "inner"
        ? e.grade === "天级"
          ? 10
          : e.grade === "地级"
            ? 4
            : 1
        : ["move", "routine", "special"].includes(e.kind)
          ? e.grade === "天级"
            ? 15
            : e.grade === "地级"
              ? 5
              : 1
          : 0));
  const insight = calculateCharacter(b).insight;
  if (!skipInsight && insight < min)
    out.push(`需要悟性 ${min}，当前 ${insight}。`);
  for (const m of (e.requirement ?? "").matchAll(
    /《([^》]+)》(修炼圆满|圆满|精通)?/g,
  )) {
    const target = [...b.inner, ...b.moves].find((x) => getEntry(x.id)?.name === m[1]);
    const required = m[2] === "精通" ? 3 : target && m[2] ? maxRank(getEntry(target.id)!) : 1;
    if (!target || target.level < required)
      out.push(`需要《${m[1]}》${m[2] ?? ""}。`);
  }
  return out;
}
export function buildIssues(
  b: Build,
  _rules: Rulings = defaultRules,
): string[] {
  void _rules;
  const errors: string[] = [];
  if (!b.name.trim()) errors.push("请填写侠士姓名。");
  if (b.kind === "pc") {
    if (!b.background) errors.push("尚未选择身世。");
    if (!b.personality) errors.push("尚未选择性格。");
    if (!b.sect) errors.push("尚未填写门派。");
    if ((b.personalityChoices ?? []).length !== 2)
      errors.push("性格需要选择两项技能。");
    if (
      b.personalityChoices.some(
        (x) => !getEntry(b.personality)?.choices?.includes(x),
      )
    )
      errors.push("性格技能不在可选范围内。");
    if (!b.inner.length) errors.push("尚未学习内功。");
    else if (!b.activeInner) errors.push("请选择一门运行内功。");
    if (
      getEntry(b.background)?.name === "小贩" &&
      getEntry("skill-" + b.backgroundSkillChoice)?.grade !== "技艺"
    )
      errors.push("小贩身世还需选择一项技艺。");
    if (!b.moves.length) errors.push("尚未学习武学招式。");
  }
  if (b.activeInner && !b.inner.some((x) => x.id === b.activeInner))
    errors.push("运行内功必须是已学内功。");
  for (const type of ["inner", "moves"] as const) {
    const seen = new Set();
    for (const l of b[type]) {
      const e = getEntry(l.id);
      if (!e) {
        errors.push("资料条目不存在：" + l.id);
        continue;
      }
      if (seen.has(l.id)) errors.push("不能重复学习同一条目。");
      seen.add(l.id);
      if (l.level < 1 || l.level > maxRank(e))
        errors.push(e.name + "的阶段超出范围。");
    }
  }
  const slots: Record<string, number> = {};
  errors.push(...inventoryIssues(b));
  for (const id of b.equipment) {
    const e = getEntry(id);
    if (!e) continue;
    const s = e.slot || "行囊";
    slots[s] = (slots[s] ?? 0) + 1;
  }
  for (const [s, n] of Object.entries(slots))
    if (
      n >
      (s === "戒指"
        ? 2
        : s === "饰品"
          ? 6
          : ["行囊", "武器"].includes(s)
            ? 999
            : 1)
    )
      errors.push(`${s}装备数量超出可穿戴上限。`);
  const points =
    [...new Set([...b.meridians, ...b.equipment])].reduce(
      (n, id) => n + (getEntry(id)?.freePoints ?? 0),
      0,
    ) + (b.traits.includes("玄关") ? 100 : 0);
  const used = Object.values(b.freeAttributes ?? blankStats()).reduce(
    (s, n) => s + n,
    0,
  );
  if (used > points)
    errors.push(`自由属性已分配 ${used}，经脉与装备提供 ${points}。`);
  for (const k of STAT_KEYS)
    if (!Number.isFinite(b.base[k]) || b.base[k] < 1)
      errors.push(STAT_NAMES[k] + "基础值须为正数。");
  if (b.bonuses.some((m) => !m.label.trim()))
    errors.push("请填写每条固定修正的来源说明。");
  return [...new Set(errors)];
}
export function actionDefaults(actorId = "", moveId = ""): ActionInput {
  return {
    actorId,
    moveId,
    targets: [],
    kind: "main",
    hit: true,
    critical: false,
    breakStance: false,
    huajin: 0,
    yinjing: 0,
    extraDamage: 0,
    distance: 1,
    attackRoll: null,
    manualNote: "",
    manualHp: {},
    manualMp: {},
    manualShield: {},
    feintRoll: null,
    seeThroughRoll: null,
    interrupted: false,
    ignoreRoutine: false,
  };
}
export function previewAction(
  campaign: Campaign,
  input: ActionInput,
): ActionResult {
  const actor = campaign.characters.find((x) => x.id === input.actorId);
  if (!actor) throw new Error("出招角色不存在。");
  const e = getEntry(input.moveId);
  if (!e) throw new Error("招式不存在。");
  const m = calculateMove(
    actor.build,
    e.id,
    undefined,
    campaign.rules,
    actor.runtime,
  );
  const a = calculateCharacter(actor.build, actor.runtime);
  const inner = activeInner(actor.build);
  const manual = !!input.manualNote.trim();
  const result: ActionResult = {
    move: m,
    targets: [],
    actorMp: m.mpCost ?? 0,
    actorRage: m.rageCost,
    actorHpLoss: 0,
    actorMpGain: 0,
    actorRageGain: 0,
    details: [`内力消耗 ${m.mpCost}；怒气消耗 ${m.rageCost}`],
    warnings: [...m.warnings],
    errors: [],
  };
  if (!actor.build.moves.some((x) => x.id === e.id))
    result.errors.push("未学习此招式。");
  if (!campaign.encounter.active) result.errors.push("DM 尚未开始战斗。");
  const turn = campaign.encounter.order[campaign.encounter.turn];
  const reaction = input.kind === "reaction" || m.action === "reaction";
  if (!reaction && turn !== actor.id)
    result.errors.push("当前不是该角色的回合。");
  const action = reaction
    ? "reaction"
    : m.action === "minor"
      ? "minor"
      : "main";
  if (!actor.runtime[action] && (action !== "minor" || !actor.runtime.main))
    result.errors.push("本回合已消耗所需动作。");
  if (m.action === "charge" && !actor.runtime.minor)
    result.errors.push("蓄力招式同时需要次要动作。");
  if (actor.runtime.hp <= 0) result.errors.push("角色已濒死，不能正常出招。");
  if (
    ["定身", "点穴", "眩晕", "昏迷", "自闭"].some((n) => has(actor.runtime, n))
  )
    result.errors.push("角色当前状态使其失去全部动作。");
  if (
    action === "reaction" &&
    ["耳鸣/失聪", "迟滞"].some((n) => has(actor.runtime, n))
  )
    result.errors.push("状态使角色无法消耗反应动作。");
  if (action === "main" && has(actor.runtime, "封招"))
    result.errors.push("封招状态使角色失去主要动作。");
  if (action === "minor" && ["缚身", "剧痛"].some((n) => has(actor.runtime, n)))
    result.errors.push("状态使角色失去次要动作。");
  const ban: Record<string, string> = {
    实招: "禁实",
    虚招: "禁虚",
    反击: "禁反",
    气招: "禁气",
    绝招: "禁绝",
  };
  if (has(actor.runtime, ban[e.moveType ?? ""]))
    result.errors.push("当前状态禁止该类招式。");
  if (e.moveType === "架招" && has(actor.runtime, "破防"))
    result.errors.push("破防期间不能开启架招。");
  if (has(actor.runtime, "缴械") && m.weapon !== "徒手")
    result.errors.push("缴械期间只能施展徒手招式。");
  if (
    actor.runtime.usedRoutine &&
    e.parentId &&
    actor.runtime.usedRoutine !== e.parentId &&
    !input.ignoreRoutine
  )
    result.errors.push("套路仍在调息，需等到下个回合初。");
  if (input.ignoreRoutine && !manual)
    result.errors.push("忽略套路调息需要注明规则依据。");
  if (m.mpCost === null) result.errors.push('本招消耗待裁定，不能自动结算。');
  if (actor.runtime.mp < (m.mpCost ?? 0)) result.errors.push("内力不足。");
  if (actor.runtime.rage < m.rageCost) result.errors.push("怒气不足。");
  if (input.huajin > stack(actor.runtime, "化劲"))
    result.errors.push("化劲层数不足。");
  if (input.yinjing > stack(actor.runtime, "引劲"))
    result.errors.push("引劲层数不足。");
  if (input.huajin && inner.entry?.name !== "太极神功")
    result.errors.push("消耗化劲需要运行太极神功。");
  if (
    m.damage === null &&
    (!manual || input.targets.some((id) => !(id in input.manualHp)))
  )
    result.errors.push(
      "伤害公式尚未完整确定，需要 DM 为每个目标填写最终气血扣除值和依据。",
    );
  if (
    (Object.keys(input.manualHp).length ||
      Object.keys(input.manualMp).length ||
      Object.keys(input.manualShield).length ||
      input.extraDamage ||
      input.yinjing) &&
    !manual
  )
    result.errors.push("临时加成、资源特效或手动修正必须记录依据。");
  if (e.fullAction && !actor.runtime.reaction)
    result.errors.push("全回合动作还需要反应动作。");
  if (e.lightness && !e.text.includes("动作"))
    result.errors.push("该轻功是常驻被动效果，无需出招。");
  if (m.damageType !== "none" && !input.targets.length)
    result.errors.push("请选择至少一个目标。");
  const effect = activeEffect(actor.build);
  if (
    effect &&
    !["正气歌", "太极神功", "化功秘法", "北冥鲲鹏诀"].includes(
      inner.entry?.name ?? "",
    )
  )
    result.warnings.push("运行内功需核对：" + effect.replace(/\s/g, ""));
  if (input.huajin)
    result.details.push(
      `化劲 ${input.huajin} 层 × 10 = +${input.huajin * 10} 招式伤害`,
    );
  const weapon = getEntry(actor.build.activeWeapon);
  if (m.weapon && m.weapon !== "徒手" && weapon?.weapon !== m.weapon && !manual)
    result.errors.push(`需要持握${m.weapon}类武器；特殊豁免请填写裁定依据。`);
  if (weapon) {
    const req = e.requirement?.split("属性")[0];
    if (req?.includes("-") && !req.includes(weapon.subtype ?? "不存在"))
      result.warnings.push(
        `请核对武器子类型：需要 ${req}，当前 ${weapon.subtype ?? weapon.name}。`,
      );
    if (weapon.text.includes("效果"))
      result.warnings.push(
        "武器特效待核对：" + (weapon.text.split("效果：")[1] ?? weapon.text),
      );
  }
  if (m.type === "反击")
    result.warnings.push(
      "反击自动命中且不暴击；DM 请确认已看破针对自己的虚招与压制顺序。",
    );
  for (const id of [...new Set(input.targets)]) {
    const target = campaign.characters.find((x) => x.id === id);
    if (!target) {
      result.errors.push("目标不存在。");
      continue;
    }
    const t = calculateCharacter(target.build, target.runtime);
    const ti = activeInner(target.build);
    const physical = m.damageType === "physical";
    const attackMods = effectModifiers(
      actor.build,
      actor.runtime,
      e,
      m.rank,
      a,
    );
    const localBonus = (k: string) =>
      attackMods.filter((m) => m.key === k).reduce((n, m) => n + m.value, 0);
    const special = !["physical", "internal"].includes(m.damageType);
    let hit = input.hit;
    if (input.attackRoll !== null)
      hit =
        input.attackRoll === 20 ||
        (input.attackRoll !== 1 &&
          input.attackRoll +
            (physical
              ? a.physicalHit + localBonus("physicalHit")
              : a.internalHit + localBonus("internalHit")) >=
            t.dodge);
    if (m.type === "反击") hit = true;
    if (input.interrupted) hit = false;
    let critical =
      (input.attackRoll !== null
        ? input.attackRoll >=
          (physical
            ? a.physicalCrit + localBonus("physicalCrit")
            : a.internalCrit + localBonus("internalCrit"))
        : input.critical) || has(target.runtime, "自闭");
    if (
      (reaction && inner.entry?.name !== "五绝神典") ||
      m.type === "反击" ||
      special
    )
      critical = false;
    let broken =
      hit && m.type === "虚招" && !!target.runtime.stance && input.breakStance;
    if (
      hit &&
      m.type === "虚招" &&
      target.runtime.stance &&
      input.feintRoll !== null &&
      input.seeThroughRoll !== null
    ) {
      const grade = e.grade === "天级" ? 4 : e.grade === "地级" ? 3 : 2;
      const feint =
        (a.weaponSkills[m.weapon] ?? 0) +
        m.rank * grade +
        a.details
          .filter((x) => x.key === "feint")
          .reduce((s, x) => s + x.value, 0);
      broken = input.feintRoll + feint >= input.seeThroughRoll + t.lookThrough;
      result.details.push(
        `虚招 ${input.feintRoll}+${feint} 对看破 ${input.seeThroughRoll}+${t.lookThrough}：${broken ? "破架" : "被看破，可能触发反击"}`,
      );
    } else if (hit && m.type === "虚招" && target.runtime.stance)
      result.warnings.push(
        "虚招对抗尚由 DM 判定；勾选破架或填写双方骰值。被反击压制时请勾选「出招中断」。",
      );
    const out: TargetResult = {
      id,
      hit,
      critical,
      broken,
      hpDamage: 0,
      shieldDamage: 0,
      mpLoss: 0,
      hpLoss: 0,
      ordinary: 0,
      poison: 0,
      details: [],
      warnings: [],
    };
    if (m.distance > 0 && input.distance > m.distance && m.type !== "反击")
      result.errors.push(
        `目标 ${target.build.name} 距离 ${input.distance} 米，超出招式 ${m.distance} 米。`,
      );
    if (hit && m.damageType !== "none") {
      let base = (m.damage ?? 0) + input.huajin * 10 + input.extraDamage;
      if (
        e.name === "阳重三叠" &&
        target.runtime.history[actor.id + ":" + e.id]
      ) {
        const extra = 5 * m.rank;
        base += extra;
        out.details.push("本目标此前受此招伤害 +" + extra);
      }
      if (has(target.runtime, "错骨")) {
        base += 10;
        out.details.push("目标错骨 +10");
      }
      if (
        getEntry(actor.build.background)?.name === "卑鄙小人" &&
        has(target.runtime, "倒地")
      ) {
        base += 5;
        out.details.push("卑鄙小人攻击倒地目标 +5");
      }
      if (critical) base *= 2;
      const defense = physical
        ? t.physicalDefense
        : m.damageType === "internal"
          ? t.internalDefense
          : m.damageType === "poison"
            ? (t.skills["韧性"] ?? 0)
            : m.damageType === "bleed"
              ? (t.skills["凝血"] ?? 0)
              : 0;
      const block = special || broken ? 0 : t.block;
      let reduction = 0;
      if (!special && ti.entry?.name === "太极神功")
        reduction = ti.level === 1 ? 5 : 10;
      if (!special && ti.entry?.name === "北冥鲲鹏诀")
        reduction = (m.mpCost ?? 0) * (ti.level === 3 ? 2 : 1);
      const after = Math.max(0, base - defense - block - reduction);
      out.ordinary = after;
      out.details.push(
        `招式 ${base}${critical ? "（暴击已翻倍）" : ""} − 防御 ${defense} − 格挡 ${block} − 运功减伤 ${reduction} = ${after}`,
      );
      if (inner.entry?.name === "化功秘法" && inner.level >= 2) {
        out.mpLoss = 5;
        out.poison = Math.max(
          0,
          (inner.level === 3 ? 20 : 10) - (t.skills["韧性"] ?? 0),
        );
        out.details.push(
          `化功：毒伤 ${inner.level === 3 ? 20 : 10} − 韧性 ${t.skills["韧性"] ?? 0} = ${out.poison}；内力流失 5（不是伤害）`,
        );
        if (inner.level === 3 && target.runtime.hp <= after + out.poison)
          out.warnings.push(
            "化功圆满：濒死目标修为流失 500，每日限制由 DM 处理。",
          );
      }
      if (
        inner.entry?.name === "北冥鲲鹏诀" &&
        inner.level >= 2 &&
        !target.runtime.stance
      ) {
        const steal = Math.min(target.runtime.mp, inner.level === 3 ? 10 : 5);
        out.mpLoss += steal;
        result.actorMpGain += steal;
        out.details.push("北冥吸取内力 " + steal);
        out.warnings.push("北冥圆满的修为与余伤联动请按原文处理。");
      }
      if (after > 0 && !special) {
        if (has(target.runtime, "撕裂")) out.hpLoss += 10;
        if (has(target.runtime, "震伤")) out.hpLoss += 10;
      }
      if (after + out.poison > 0)
        out.hpLoss += stack(target.runtime, "易伤") * 10;
      out.shieldDamage = Math.min(target.runtime.shield, after + out.poison);
      const remaining = after + out.poison - out.shieldDamage;
      out.hpDamage = Math.min(target.runtime.hp, remaining);
      if (remaining > target.runtime.hp) {
        const over = remaining - target.runtime.hp;
        const poisonOverflow = Math.min(out.poison, over);
        const normalOverflow = over - poisonOverflow;
        out.mpLoss += special
          ? over
          : Math.ceil(normalOverflow / 5) + poisonOverflow;
        out.warnings.push(
          "进入或处于濒死：需要残疾检定；内力归零时需要死亡检定。",
        );
      }
      if (
        !special &&
        after > 0 &&
        !target.runtime.stance &&
        !broken &&
        actor.build.kind !== target.build.kind
      )
        result.actorRageGain = 1;
      if (
        !special &&
        after > 0 &&
        broken &&
        actor.build.kind !== target.build.kind
      )
        result.actorRageGain = 1;
      if (e.name === "阳重三叠")
        out.details.push("只有该目标实际受到本招伤害时，才记录本场命中历史。");
    } else
      out.details.push(
        input.interrupted
          ? "出招中断：照常消耗动作和资源。"
          : "未命中或无直接伤害。",
      );
    if (
      target.runtime.conditions.some(
        (x) =>
          ![
            "化劲",
            "引劲",
            "护身",
            "磐石",
            "破甲",
            "倒地",
            "破防",
            "震伤",
            "撕裂",
            "易伤",
            "墨舞",
          ].includes(x.name),
      )
    )
      out.warnings.push("请核对目标状态的触发、免疫和先后顺序。");
    if (
      ti.entry &&
      !["正气歌", "太极神功", "北冥鲲鹏诀", "化功秘法"].includes(ti.entry.name)
    )
      out.warnings.push(
        `目标运功效果待核对：${activeEffect(target.build).replace(/\s/g, "")}`,
      );
    if (id in input.manualHp) {
      out.details.push(`DM 修正最终气血扣除为 ${input.manualHp[id]}（含流失）`);
      out.hpDamage = input.manualHp[id];
      out.hpLoss = 0;
    }
    if (id in input.manualMp) out.mpLoss = input.manualMp[id];
    if (id in input.manualShield) out.shieldDamage = input.manualShield[id];
    result.targets.push(out);
  }
  if (result.warnings.length || result.targets.some((t) => t.warnings.length))
    result.details.push(
      "请处理列出的附加效果后再确认；基础伤害与完整行动并非同一结果。",
    );
  if (has(actor.runtime, "不怒")) result.actorRageGain = 0;
  return result;
}
