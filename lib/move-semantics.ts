import type { Entry, MoveResult } from "./types.ts";
export type ReleaseMode = {
  id: string;
  label: string;
  action: MoveResult["action"];
  full?: boolean;
  actionLabel?: string;
  trigger?: string;
  auxiliary?: boolean;
  effect?: string;
};
export function releaseModes(e: Entry): ReleaseMode[] {
  if (e.name === "第一式-佛光乍现")
    return [
      { id: "main", label: "主动出掌", action: "main" },
      {
        id: "reaction",
        label: "反应出掌",
        action: "reaction",
        trigger: "有敌人处于半空中",
      },
    ];
  if (e.name === "仙人舞剑")
    return [
      { id: "charge", label: "起舞攻击", action: "charge" },
      {
        id: "response",
        label: "呼应友方",
        action: "reaction",
        trigger: "友方释放仙人舞剑",
        auxiliary: true,
        effect: "为友方和自身添加仙舞，持续两回合；本分支不沿用主动攻击伤害。",
      },
    ];
  const text = e.text
    .split(/升级[:：]/)[0]
    .split("\n")
    .filter((l) => !/^类型/.test(l))
    .join("");
  const a = text.match(/(主要|次要|简要|蓄力|全回合|反应)动作/);
  const action =
    e.moveType === "反击"
      ? "reaction"
      : a
        ? (
            {
              主要: "main",
              次要: "minor",
              简要: "simple",
              蓄力: "charge",
              全回合: "charge",
              反应: "reaction",
            } as const
          )[a[1] as "主要"]
        : (e.formula?.action ?? "main");
  return [
    {
      id: "default",
      label: a ? a[1] + "动作" : "原文施展方式",
      action,
      actionLabel: /不消耗动作/.test(text)
        ? "不消耗动作"
        : /花费小憩/.test(text)
          ? "花费小憩"
          : !a && !e.formula
            ? "动作方式未单列，见原文"
            : undefined,
      full: a?.[1] === "全回合" || e.fullAction,
    },
  ];
}
export function checkDamage(e: Entry) {
  const body = e.text.split(/升级[:：]/)[0].replace(/\s/g, "");
  const first = body.match(/(?:造成|受到|失败受)[^。]*?(?:内功|外功)伤害/);
  return (
    !!first &&
    /检定[\s\S]*失败(?:则)?(?:受到|受)/.test(
      body.slice(0, (first.index ?? 0) + first[0].length),
    )
  );
}
export const actionText = (m: ReleaseMode) =>
  m.actionLabel ??
  (m.full
    ? "全回合（主要＋次要＋简要＋反应）"
    : {
        main: "主要动作",
        minor: "次要动作",
        simple: "简要动作",
        charge: "蓄力（主要＋次要）",
        reaction: "反应动作",
      }[m.action]);
export function weaponRequirement(e: Entry, weapon: Entry | undefined) {
  const req = (e.requirement ?? "").match(
    /(徒手|剑|刀|棍|匕首|暗器|乐器|奇门)(?:[-－]([^，。\s属]+))?/,
  );
  if (!req || req[1] === "徒手") return null;
  if (!weapon) return `需持握${req[0]}`;
  if (weapon.weapon !== req[1] || (req[2] && weapon.subtype !== req[2]))
    return `需${req[0]}，当前持握${weapon.weapon ?? ""}${weapon.subtype ? "-" + weapon.subtype : ""}`;
  return null;
}
