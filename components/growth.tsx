"use client";
import { useEffect, useState } from "react";
import { catalog, getEntry, maxRank, xpCost, rankLabel } from "@/lib/catalog";
import {
  growthData,
  growthProblems,
  trainingProgress,
  dantianCapacity,
  applyGrowth,
} from "@/lib/growth";
import { calculateCharacter } from "@/lib/rules";
import type { Character } from "@/lib/types";
import { useApp } from "./app-context";
export function GrowthPanel({ ch }: { ch: Character }) {
  return <GrowthEditor key={ch.id} ch={ch} />;
}
function GrowthEditor({ ch }: { ch: Character }) {
  const a = useApp(),
    g = growthData(ch),
    c = calculateCharacter(ch.build);
  const blank = {
    revision: ch.revision,
    kind: "invest",
    day: g.day,
    entryId: "",
    innerId: "",
    amount: 200,
    die: 10,
    note: "",
    prerequisites: false,
  };
  const [draft, set] = useState(blank),
    [query, setQuery] = useState(""),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false);
  const key = "xia-growth-draft:" + ch.id;
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        const old = localStorage.getItem(key);
        if (old) {
          set(JSON.parse(old));
          setDirty(true);
        }
      } catch {}
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [key]);
  const update = (value: Partial<typeof blank>) => {
    set((d) => ({
      ...d,
      revision: dirty ? d.revision : ch.revision,
      ...value,
    }));
    setDirty(true);
  };
  useEffect(() => {
    if (ready && dirty)
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {}
  }, [draft, dirty, ready, key]);
  const selected = getEntry(draft.entryId),
    progress = selected ? trainingProgress(ch, selected.id) : 0,
    next = selected
      ? Array.from({ length: maxRank(selected) }, (_, i) => i + 1).find(
          (l) => xpCost(selected, l) > progress,
        )
      : undefined;
  const entries = catalog
    .filter((e) =>
      draft.kind === "invest"
        ? ["inner", "move", "special"].includes(e.kind) && e.learnable !== false
        : e.kind === "meridian" &&
          (draft.kind === "extraordinary"
            ? e.grade === "奇经八脉"
            : e.grade !== "奇经八脉"),
    )
    .filter((e) => !query || e.name.includes(query))
    .slice(0, 60);
  const operation =
    draft.kind === "gain"
      ? { kind: "gain", day: draft.day, note: draft.note, amount: draft.amount }
      : draft.kind === "invest"
        ? {
            kind: "invest",
            day: draft.day,
            note: draft.note,
            amount: draft.amount,
            entryId: draft.entryId,
            prerequisites: draft.prerequisites,
          }
        : draft.kind === "extraordinary"
          ? {
              kind: draft.kind,
              day: draft.day,
              note: draft.note,
              entryId: draft.entryId,
              prerequisites: draft.prerequisites,
            }
          : {
              kind: draft.kind,
              day: draft.day,
              note: draft.note,
              entryId: draft.entryId,
              innerId: draft.innerId,
              die: draft.die,
            };
  let preview = "",
    problem = "";
  try {
    const copy = structuredClone(ch);
    preview =
      applyGrowth(copy, operation, a.campaign!.rules) +
      `；丹田修为 ${ch.build.xp} → ${copy.build.xp}`;
    const nextStats = calculateCharacter(copy.build);
    for (const [key, label] of [["hpMax", "气血上限"], ["mpMax", "内力上限"]] as const) {
      if (nextStats[key] !== c[key]) preview += `；${label} ${c[key]} → ${nextStats[key]}`;
    }
    if (nextStats.hpMax !== c.hpMax || nextStats.mpMax !== c.mpMax) preview += "；当前资源保持不变，请按桌上裁定手动调整";
  } catch (e) {
    problem = e instanceof Error ? e.message : "请完善选择";
    if (problem.startsWith("[")) problem = "请完善选择、数值与前置条件确认";
  }
  const save = async () => {
    if (
      await a.mutate("grow", {
        id: ch.id,
        revision: dirty ? draft.revision : ch.revision,
        operation,
      })
    ) {
      localStorage.removeItem(key);
      setDirty(false);
      set({ ...blank, day: draft.day, revision: ch.revision + 1 });
    }
  };
  return (
    <details className="paper panel growth-panel">
      <summary>
        <b>修炼与经脉</b> · 丹田修为 {ch.build.xp} / {dantianCapacity(ch)}
      </summary>
      <p>
        今日投入 {g.spent[draft.day] ?? 0} / {c.insight * 200}（悟性 {c.insight}{" "}
        × 200）
      </p>
      {!!growthProblems(ch).length && (
        <p className="warning">
          历史经脉待补录内功来源：
          {growthProblems(ch)
            .map((id) => getEntry(id)?.name)
            .join("、")}
          。原收益保留；补录后可继续冲关。
        </p>
      )}
      <div className="trial-inputs">
        <label className="field">
          <span>记录类型</span>
          <select
            value={draft.kind}
            onChange={(e) => update({ kind: e.target.value, entryId: "" })}
          >
            <option value="invest">投入修为</option>
            <option value="gain">获得修为</option>
            <option value="meridian">冲关 · 实体骰</option>
            <option value="bind">补录经脉来源</option>
            <option value="extraordinary">确认奇经条件</option>
          </select>
        </label>
        <label className="field">
          <span>游戏内修炼日</span>
          <input
            value={draft.day}
            maxLength={80}
            onChange={(e) => update({ day: e.target.value })}
          />
        </label>
      </div>
      {draft.kind !== "gain" && (
        <>
          <label className="field">
            <span>搜索功法或经脉（最多显示 60 项，请输入名称筛选）</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="field">
            <span>选择项目</span>
            <select
              value={draft.entryId}
              onChange={(e) => update({ entryId: e.target.value })}
            >
              <option value="">请选择</option>
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.grade}
                  {e.routine ? " · " + e.routine : ""}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {selected && draft.kind === "invest" && (
        <p>
          已投入 {progress}；
          {![...ch.build.inner, ...ch.build.moves].some(l => l.id === selected.id) && xpCost(selected, 1) === 0
            ? `${rankLabel(selected, 1)}无需修为，可先学会后继续投入`
            : next
            ? `距离${rankLabel(selected, next)}还需 ${xpCost(selected, next) - progress}`
            : "已修满"}
          。未达阶段的投入会保留。
        </p>
      )}
      {["invest", "gain"].includes(draft.kind) && (
        <label className="field">
          <span>
            {draft.kind === "gain" ? "获得修为（加成前）" : "本次投入"}
          </span>
          <input
            type="number"
            min={draft.kind === "invest" ? "0" : "1"}
            value={draft.amount}
            onChange={(e) => update({ amount: Number(e.target.value) })}
          />
          {draft.kind === "invest" && selected && xpCost(selected, 1) === 0 && ![...ch.build.inner, ...ch.build.moves].some(l => l.id === selected.id) && <button className="button" onClick={() => update({ amount: 0 })}>先学会{rankLabel(selected, 1)} · 0 修为</button>}
        </label>
      )}
      {["meridian", "bind"].includes(draft.kind) && (
        <label className="field">
          <span>提供真气的圆满内功（每门仅用于一条经脉）</span>
          <select
            value={draft.innerId}
            onChange={(e) => update({ innerId: e.target.value })}
          >
            <option value="">请选择</option>
            {(draft.kind === "bind"
              ? catalog
                  .filter((e) => e.kind === "inner")
                  .map((e) => ({ id: e.id, level: maxRank(e) }))
              : ch.build.inner.filter(
                  (l) => getEntry(l.id) && l.level === maxRank(getEntry(l.id)!),
                )
            ).map((l) => (
              <option key={l.id} value={l.id}>
                {getEntry(l.id)?.name}
                {Object.values(g.sources).includes(l.id) || g.usedInner?.[l.id] ? " · 已使用" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {draft.kind === "meridian" && (
        <label className="field">
          <span>实体 D20 结果（无加值；每次消耗500修为）</span>
          <input
            type="number"
            min="1"
            max="20"
            value={draft.die}
            onChange={(e) => update({ die: Number(e.target.value) })}
          />
          {selected && (
            <small>
              本次难度{" "}
              {(
                { 第一关: 11, 第二关: 15, 第三关: 19 } as Record<string, number>
              )[selected.grade] -
                5 * (g.attempts[selected.id] ?? 0)}
            </small>
          )}
        </label>
      )}
      {["invest", "extraordinary"].includes(draft.kind) && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.prerequisites}
            onChange={(e) => update({ prerequisites: e.target.checked })}
          />
          已在桌上确认传授、瓶颈、身份／奇珍等前置条件
        </label>
      )}
      <label className="field">
        <span>来源／裁定备注</span>
        <textarea
          value={draft.note}
          maxLength={1000}
          onChange={(e) => update({ note: e.target.value })}
        />
      </label>
      {dirty && draft.revision !== ch.revision && (
        <p className="warning">
          角色已有更新，输入已保留。核对上方最新资源后再保存。
          <button
            className="text-button"
            onClick={() => update({ revision: ch.revision })}
          >
            已核对，采用最新版本
          </button>
        </p>
      )}
      <p className={problem ? "muted" : "preview-result"} role="status">
        {problem || preview}
      </p>
      <button
        className="button primary"
        disabled={
          !!problem ||
          !a.online ||
          a.busy ||
          (dirty && draft.revision !== ch.revision)
        }
        onClick={save}
      >
        确认以上变化，保存记录
      </button>
      <details>
        <summary>成长记录 · {g.records.length} 条</summary>
        {g.records.map((r, i) => (
          <p key={i}>
            <b>
              {r.day} · {r.label}
            </b>
            <br />
            <small>
              {r.at} {r.note}
            </small>
          </p>
        ))}
      </details>
    </details>
  );
}
