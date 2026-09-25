"use client";
import { MovePreview } from "./move-preview";
import { NumberHelp } from "./number-help";
import { explainMove } from "@/lib/explanations";
import { movePresentation } from "@/lib/move-presentation";
import { Star } from "lucide-react";
import { catalog, getEntry, rankLabel, sourceLabel } from "@/lib/catalog";
import { calculateMove } from "@/lib/rules";
import type { Build, Entry, Rulings } from "@/lib/types";
import {
  cleanRuleText,
  damageNames,
  equipmentReference,
  movePurposes,
  moveReference,
} from "@/lib/reference-presentation";
import { RuleNotes } from "./rule-notes";
import { RuleTerm } from "./rules-help";
import { topicForMoveType } from "@/lib/rule-guide";

export function EquipmentSummary({ entry }: { entry: Entry }) {
  const item = equipmentReference(entry);
  return (
    <span className="equipment-summary">
      <span className="equipment-stats">
        {entry.slot === "武器" && (
          <>
            <span>
              伤害 <b>{entry.weaponDamage ?? "未列"}</b>
            </span>
            <span>
              格挡 <b>{entry.weaponBlock ?? "未列"}</b>
            </span>
          </>
        )}
        <span>{item.type}</span>
        {item.price && <span>{item.price}</span>}
      </span>
      <span className="equipment-effect">
        {item.effect || "原书未列附加效果"}
      </span>
    </span>
  );
}

export function MoveReference({
  build,
  id,
  level,
  rules,
  onDetail,
  onFavorite,
  favorite,
  baselineWarnings = [],
  embedded = false,
}: {
  build: Build;
  id: string;
  level: number;
  rules?: Rulings;
  onDetail?: (entry: Entry) => void;
  onFavorite?: () => void;
  favorite?: boolean;
  baselineWarnings?: string[];
  embedded?: boolean;
}) {
  const e = getEntry(id);
  if (!e) return null;
  const m = calculateMove(build, id, level, rules);
  const ref = moveReference(e, m);
  const p = movePresentation(e, m, build);
  return (
    <article
      className={
        embedded
          ? "reference-move embedded-move"
          : "paper move-card reference-move"
      }
      data-move-type={e.moveType}
    >
      {!embedded && (
        <>
          <div className="section-heading">
            <div>
              <span className="move-kind">
                {movePurposes[e.moveType ?? ""] ?? "散手"} ·{" "}
                <RuleTerm topic={topicForMoveType(e.moveType)} label={e.moveType ?? "散手"} />
              </span>
              <h3>{e.name}</h3>
              <small>
                {e.routine || "独立散手"} · {rankLabel(e, level)} ·{" "}
                {e.affinity || e.grade}
              </small>
            </div>
            {onFavorite && (
              <button
                className="icon-button"
                aria-label={`收藏${e.name}`}
                aria-pressed={favorite}
                onClick={onFavorite}
              >
                <Star size={18} fill={favorite ? "currentColor" : "none"} />
              </button>
            )}
          </div>
          <div className="reference-numbers">
            {e.moveType === "架招" ? (
              <div>
                <small>开启后基础格挡</small>
                <strong>
                  <NumberHelp help={explainMove(m, "block", rules)}>
                    {m.block}
                  </NumberHelp>
                </strong>
              </div>
            ) : m.damageType !== "none" ? (
              <>
                <div>
                  <small>{damageNames[m.damageType]}基础伤害</small>
                  <strong>
                    <NumberHelp help={explainMove(m, "damage", rules)}>
                      {m.damage ?? "待裁定"}
                    </NumberHelp>
                  </strong>
                </div>
                {m.critical !== null && (
                  <div>
                    <small>适用暴击</small>
                    <strong>
                      <NumberHelp help={explainMove(m, "critical", rules)}>
                        {m.critical}
                      </NumberHelp>
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <div>
                <small>{p.primary?.label ?? "招式用途"}</small>
                <strong className="text-value">
                  {p.primary?.value ?? "辅助 / 见效果"}
                </strong>
              </div>
            )}
            <div className="move-cost">
              <small>消耗</small>
              <strong className="text-value">
                <NumberHelp help={explainMove(m, "cost", rules)}>
                  {p.cost}
                </NumberHelp>
              </strong>
            </div>
          </div>
          <div className="move-facts">
            <RuleTerm topic="actions" label={p.action} />
            <span>{p.range}</span>
            <span>需求：{p.requirement}</span>
            <span>{p.affinity}</span>
            {p.target && <span>对象：{p.target}</span>}
            {p.duration && <span>{p.duration}</span>}
          </div>
          {p.trigger && <p className="inset">{p.trigger}</p>}
          {p.conditional && <p className="inset">{p.conditional}</p>}
        </>
      )}
      {e.grantedBy && (
        <p>
          获得方式：随《{getEntry(e.grantedBy)?.name}》掌握，阶段与该散手一致。
        </p>
      )}
      <MovePreview build={build} id={id} level={level} rules={rules} />
      <div className="move-effects">
        <h4>
          招式效果
          {ref.upgrade && level > 1
            ? " · 领悟阶段原文"
            : ref.stageBreakdown.length
              ? ` · ${rankLabel(e, level)}阶段`
              : ""}
        </h4>
        {ref.effects.length ? (
          <ul>
            {ref.effects.map((p, i) => (
              <li key={i}>
                <EffectText text={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p>此招说明需查看完整原文。</p>
        )}
      </div>
      {!!ref.stageBreakdown.length && (
        <div className="rank-effect">
          <b>
            {rankLabel(e, level)}阶段怎么算 · 已升级 {level - 1} 次
          </b>
          {ref.stageBreakdown.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
      <StatusGlossary text={ref.effects.join("")} />
      {ref.upgrade && (
        <div className="rank-effect">
          <b>附加效果随等级变化</b>
          <p>
            当前为{rankLabel(e, level)}（第 {level} 阶）。每升一阶：
            {ref.upgrade}
          </p>
          <small>
            面板列出已支持的阶段数值；上文保留各项效果与条件，现场按触发时点处理。
          </small>
        </div>
      )}
      <RuleNotes items={m.warnings.filter(w=>!w.startsWith("效果待处理："))} baseline={baselineWarnings} entry={e} hideShared={embedded} />
      <details className="disclosure">
        <summary>计算依据与完整原文</summary>
        <div className="trace">
          {m.details.map((x, i) => (
            <div key={i}>
              <span>{x.label}</span>
              <b>{x.value}</b>
            </div>
          ))}
        </div>
        <p className="rule-text">{e.text}</p>
        <small>{sourceLabel(e)}</small>
        {onDetail && (
          <button className="text-button" onClick={() => onDetail(e)}>
            查看功法与修炼阶段 →
          </button>
        )}
      </details>
    </article>
  );
}

const statuses = catalog.filter((e) => e.kind === "status");
function StatusGlossary({ text }: { text: string }) {
  const found = statuses.filter((e) =>
    e.name.split("/").some((name) => text.includes(name)),
  );
  if (!found.length) return null;
  return (
    <details className="status-glossary">
      <summary>状态释义 · {found.map((e) => e.name).join(" / ")}</summary>
      {found.map((e) => (
        <div key={e.id}>
          <b>{e.name}</b>
          <p>
            {cleanRuleText(
              e.text.includes("·")
                ? e.text.slice(e.text.indexOf("·")).replaceAll("·", "")
                : e.text,
            )}
          </p>
          <small>{sourceLabel(e)}</small>
        </div>
      ))}
    </details>
  );
}
function EffectText({ text }: { text: string }) {
  const split = text.match(/^(.*?(?:时|后|：|:))[，,]?([\s\S]+)$/);
  return split ? (
    <>
      <strong>{split[1]}</strong>
      {split[2]}
    </>
  ) : (
    <>{text}</>
  );
}
