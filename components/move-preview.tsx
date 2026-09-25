"use client";
import { RuleNotes } from "./rule-notes";
import { RuleTerm } from "./rules-help";
import { calculateCharacter } from "@/lib/rules";
import { useState } from "react";
import { previewMove, type PreviewContext } from "@/lib/move-preview";
import { getEntry, rankLabel } from "@/lib/catalog";
import type { Build, Rulings } from "@/lib/types";
export function MovePreview({
  build,
  id,
  level,
  rules,
}: {
  build: Build;
  id: string;
  level: number;
  rules?: Rulings;
}) {
  const [context, setContext] = useState<PreviewContext>({});
  const [open, setOpen] = useState(false);
  const e = getEntry(id)!;
  const p = previewMove(build, id, level, rules, context),
    inner = getEntry(build.activeInner);
  const bool = (key: keyof PreviewContext, label: string) => (
    <label className="check-row">
      <input
        type="checkbox"
        checked={!!context[key]}
        onChange={(ev) => setContext({ ...context, [key]: ev.target.checked })}
      />
      {label}
    </label>
  );
  const number = (key: keyof PreviewContext, label: string, max = 100000) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        max={max}
        value={typeof context[key] === "number" ? (context[key] as number) : ""}
        placeholder="未投入"
        onChange={(ev) =>
          setContext({
            ...context,
            [key]:
              ev.target.value === ""
                ? undefined
                : Math.max(0, Math.min(max, Number(ev.target.value))),
          })
        }
      />
    </label>
  );
  return (
    <section className="move-trial">
      <p className="check-formula">{p.dice}</p>
      {p.feint && <p>{p.feint} <RuleTerm topic="feint" label="看虚招步骤" /></p>}
      <button
        className="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "收起条件试算" : "本次条件试算"}
      </button>
      {open && (
        <div className="trial-content">
          <p className="muted">
            {rankLabel(e, level)} · 只计算本次参考值，资源和状态仍由你手动记录。
          </p>
          {p.modes.length > 1 && (
            <label className="field">
              <span>释放方式</span>
              <select
                value={p.mode.id}
                onChange={(ev) =>
                  setContext({ ...context, mode: ev.target.value })
                }
              >
                {p.modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            {p.action}
            {p.mode.trigger ? " · 条件：" + p.mode.trigger : ""}
          </p>
          {inner?.name === "背水诀" && bool("noStance", "本次没有开启架招")}
          {e.name === "阳重三叠" &&
            bool(
              "previousHit",
              `本次目标在本场曾被我此招造成伤害：额外＋${level * 5}＝原始5＋阶段升级${(level - 1) * 5}`,
            )}
          {inner?.name === "太极神功" &&
            number("huajin", "本次消耗化劲层数", 100)}
          {e.name === "无我无道" && number("dao", "本次消耗道的层数", 100)}
          {e.name === "九印合一" &&
            bool(
              "nineMoves",
              "本场已经施展过临、兵、斗、者、皆、阵、列、前、行九招",
            )}
          {e.name === "清商" &&
            bool("musicBonus", "演奏之前，场上商、商音阶条件已满足")}
          {/怒气X|任意.*怒气/.test(e.costText ?? "") &&
            number("spentRage", "本次投入怒气", 10)}
          {e.name === "万法如一" && number("targetRageLost", "所有目标实际失去的怒气总数（现场核对后填写）")}
          <details>
            <summary>补充已在桌上确认的数值</summary>
            <div className="trial-inputs">
              {number("extraDamage", "额外招式伤害")}
              {number("targetDefense", "目标对应防御")}
              {number("targetBlock", "目标格挡")}
            </div>
          </details>
          <div className="trial-results">
            {p.parts.map((part, i) => (
              <div key={i}>
                <span>{part.label}</span>
                <strong>{part.value ?? "见说明"}</strong>
                <small>{part.detail}</small>
              </div>
            ))}
          </div>
          {p.critical !== null && (
            <p>
              适用暴击伤害：<b>{p.critical}</b>（目标减免前）
            </p>
          )}
          {p.canCritical && !p.doubles && (
            <p>本分支可能触发暴击效果，但伤害不翻倍。</p>
          )}
          <p>
            消耗：
            {p.costs.map((x) => `${x.label} ${x.value ?? x.detail}`).join("；")}
          </p>
          {!!p.conditions.length && (
            <ul>
              {p.conditions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          <details>
            <summary>
              计算依据 ·{" "}
              基础与本次条件
            </summary>
            {p.details.map((d, i) => (
              <div className="trace-row" key={i}>
                {d.label}
                <b>{d.value}</b>
              </div>
            ))}
            {p.costs.map((d, i) => (
              <p key={"cost" + i}>
                {d.label}：{d.detail}
              </p>
            ))}

          </details>
          <RuleNotes items={p.unresolved} entry={e} baseline={calculateCharacter(build).warnings} hideShared />
          <button className="text-button" onClick={() => setContext({})}>
            清空本次条件
          </button>
        </div>
      )}
    </section>
  );
}
