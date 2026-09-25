"use client";
import { useState } from "react";
import type { ModuleContent, ModuleNpc } from "@/lib/module-types";
import { NumberHelp } from "./number-help";

const categories = {
  npc: "NPC",
  beast: "怪物",
  preset: "预生成角色",
  hazard: "特殊威胁",
};
const keyFields = [
  "气血上限",
  "内力上限",
  "体力",
  "防护",
  "命中",
  "闪避",
  "外防",
  "内防",
  "格挡",
  "暴击",
  "先攻",
  "速度",
  "游泳速度",
];
const category = (p: ModuleNpc) =>
  p.kind ?? (p.group.includes("预设") ? "preset" : "npc");
export function ModulePeople({
  module: m,
  query,
  compact = false,
}: {
  module: ModuleContent;
  query: string;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const normalized = query.replace(/\s/g, "").toLowerCase();
  const people = m.npcs.filter(
    (p) =>
      (filter === "all" || category(p) === filter) &&
      (!normalized ||
        JSON.stringify(p)
          .replace(/\s/g, "")
          .toLowerCase()
          .includes(normalized)),
  );
  return (
    <div className="module-people">
      {!compact && (
        <div className="module-asset-filters" aria-label="人物分类">
          <button
            className="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            全部 {m.npcs.length}
          </button>
          {Object.entries(categories).map(([key, label]) => (
            <button
              className="button"
              key={key}
              disabled={!m.npcs.some((p) => category(p) === key)}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label} {m.npcs.filter((p) => category(p) === key).length}
            </button>
          ))}
        </div>
      )}
      <p className="muted">
        面板与招式使用本模组原值；场景修正单独列出。点数字可查看出处。
      </p>
      {people.map((p) => (
        <article className="module-person paper" key={p.id}>
          <div className="section-heading">
            <div>
              <span className="person-category">
                {categories[category(p)]} · {p.group}
              </span>
              <h3>{p.name}</h3>
            </div>
            <span
              className={
                p.missing?.length ? "person-status incomplete" : "person-status"
              }
            >
              {p.missing?.length ? "资料有缺项" : "文字数据"}
            </span>
          </div>
          {!!p.aliases?.length && (
            <p className="muted">又称：{p.aliases.join("、")}</p>
          )}
          {p.description && (
            <p className="person-description">{p.description}</p>
          )}
          {p.fields.some((f) => keyFields.includes(f.label)) && (
            <div className="person-stat-grid">
              {keyFields
                .flatMap((key) => p.fields.filter((f) => f.label === key))
                .map((f, i) => (
                  <div key={i}>
                    <span>{f.label.replace("上限", "")}</span>
                    <strong>
                      <NumberHelp
                        help={{
                          title: `${p.name} · ${f.label}`,
                          formula: `原资料记载：${f.value}`,
                          rows: [],
                          notes: [
                            p.kind === "beast"
                              ? "野兽使用体力与防护，不把体力换算成侠士气血。场景变化见下方提醒。"
                              : "此为模组给定的固定面板，未用玩家车卡公式重新计算。",
                            p.note,
                          ].filter(Boolean),
                          source: p.source,
                        }}
                      >
                        {f.value}
                      </NumberHelp>
                    </strong>
                  </div>
                ))}
            </div>
          )}
          {p.kind === "beast" && (
            <p className="muted">
              野兽每次受到超过防护的伤害时扣 1
              体力，体力归零死亡；野兽伤害不会暴击。此处只供查阅，现场手动处理。
            </p>
          )}
          {!!p.encounters?.length && (
            <div className="person-scene">
              <b>上桌提醒</b>
              {p.encounters.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          )}
          {!!p.missing?.length && (
            <p className="person-missing">
              原资料缺项：{p.missing.join("；")}。
            </p>
          )}
          {!!(
            p.inner ||
            p.moves.length ||
            p.rows.length ||
            p.note ||
            p.fields.some((f) => !keyFields.includes(f.label))
          ) && (
            <details className="person-details" open={compact || undefined}>
              <summary>
                招式与完整资料{p.moves.length ? ` · ${p.moves.length} 招` : ""}
              </summary>
              {p.inner && (
                <p className="person-inner">
                  <b>运行内功</b> {p.inner}
                </p>
              )}
              <dl className="person-attributes">
                {p.fields
                  .filter((f) => !keyFields.includes(f.label))
                  .map((f, i) => (
                    <div key={i}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
              </dl>
              {p.moves.map((move, i) => (
                <details className="person-move" key={i} open>
                  <summary>
                    <b>{move.name}</b>
                    <span>{move.type}</span>
                    <strong>
                      {move.damage &&
                      !["/", "-", "—", "无", "原表未列"].includes(move.damage)
                        ? `${move.resultLabel ?? "伤害"} ${move.damage}`
                        : ""}
                    </strong>
                  </summary>
                  <div className="entry-meta">
                    <span>距离 {move.distance || "未注明"}</span>
                    <span>消耗 {move.cost || "未注明"}</span>
                  </div>
                  <p>{move.effect}</p>
                  <small>{move.sourceCell}</small>
                </details>
              ))}
              {p.note && <p className="muted">{p.note}</p>}
              {!!p.rows.length && (
                <details className="disclosure">
                  <summary>核对原始表格文字</summary>
                  <div className="module-source-rows">
                    {p.rows.map((row, i) => (
                      <p key={i}>
                        {row.map((c) => (
                          <span key={c.cell}>
                            <small>{c.cell}</small> {c.value}{" "}
                          </span>
                        ))}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </details>
          )}
          <a
            className="person-source"
            href={p.url || `/adventures/${m.id}#source-page-${p.sourcePage || 1}`}
            target="_blank"
            rel="noreferrer"
          >
            核对来源 · {p.source}
          </a>
        </article>
      ))}
      {!people.length && (
        <p role="status">没有匹配的人物；可切换分类或更换关键词。</p>
      )}
      {!compact && (
        <details className="disclosure">
          <summary>原始人物附件与图版</summary>
          <div className="person-source-links">
            {m.npcPages.filter(p => m.pages[p - 1]?.image).map((p) => (
              <a
                key={p}
                href={m.pages[p - 1].image}
                target="_blank"
                rel="noreferrer"
              >
                原书人物图版 · {p} 页
              </a>
            ))}
            {m.assets
              .filter((a) => a.kind === "人物卡")
              .map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                  {a.name.split("/").at(-1)}
                </a>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
