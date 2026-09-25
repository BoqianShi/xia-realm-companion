"use client";
import { contentPack } from "@/lib/content-pack";
import { RuleNotes } from "./rule-notes";
import { ruleNotes } from "@/lib/rule-notes";
import { RuleTerm, RulesHelp } from "./rules-help";
import { topicForMoveType } from "@/lib/rule-guide";
import { NumberHelp } from "./number-help";
import { explainMove } from "@/lib/explanations";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Star } from "lucide-react";
import { effectiveMoves, getEntry, rankLabel, sourceLabel } from "@/lib/catalog";
import { calculateCharacter, calculateMove } from "@/lib/rules";
import { filterGroupMoves, groupMoves, learningSource } from "@/lib/move-book";
import { isFavoriteMove } from "@/lib/move-favorites";
import { damageNames } from "@/lib/reference-presentation";
import type { Build, Entry, Learned, Rulings } from "@/lib/types";
import { MoveReference } from "./reference-card";
import { movePresentation } from "@/lib/move-presentation";

export function MoveBook({
  build,
  rules,
  onDetail,
  onFavorite,
  onStance,
  activeStance,
  favoriteDisabled = false,
  title = "我的武学",
  renderMove,
  onAdd,
  compact = false,
}: {
  build: Build;
  rules?: Rulings;
  onDetail: (e: Entry) => void;
  onFavorite?: (id: string) => void;
  onStance?: (id: string) => void;
  activeStance?: string;
  favoriteDisabled?: boolean;
  title?: string;
  renderMove?: (item: Learned) => ReactNode;
  onAdd?: () => void;
  compact?: boolean;
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("全部");
  const [favorites, setFavorites] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const learnedMoves = effectiveMoves(build);
  const displayed = compact
    ? learnedMoves.filter((m) => isFavoriteMove(build, m.id))
    : learnedMoves;
  const groups = groupMoves(displayed);
  const learnedCounts = new Map(
    groupMoves(learnedMoves).map((g) => [g.id, g.moves.length]),
  );
  const filter = { query, type, favorites };
  const filterKey = JSON.stringify([query.trim(), type, favorites]);
  const filtering = !!query.trim() || type !== "全部" || favorites;
  const visible = groups
    .map((group) => ({ group, moves: filterGroupMoves(group, build, filter) }))
    .filter((x) => x.moves.length);
  const shown = visible.reduce((n, x) => n + x.moves.length, 0);
  const baselineWarnings = calculateCharacter(build).warnings;
  const groupKey = (id: string) => `${filterKey}:${id}`;
  const isOpen = (id: string) =>
    expanded[groupKey(id)] ?? (filtering || compact);
  const toggleAll = (open: boolean) =>
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(visible.map((x) => [groupKey(x.group.id), open])),
    }));
  if (compact && !displayed.length)
    return (
      <section className="paper panel">
        <h2>{title}</h2>
        <p className="muted">
          在武学页收藏一整套武学，这里就会显示其中全部已学招式。
        </p>
        {onAdd && (
          <button className="button" onClick={onAdd}>
            查看我的武学
          </button>
        )}
      </section>
    );
  return (
    <div className="move-book">
      <div className="move-book-heading">
        <div>
          {title && <h2>{title}</h2>}
          <p className="muted">
            {groups.filter((g) => g.entry).length} 套武学
            {groups.some((g) => !g.entry) ? "及其他功法" : ""} · 共{" "}
            {displayed.length} 招{filtering ? ` · 筛选到 ${shown} 招` : ""}
          </p>
        </div>
        <div className="button-group">
          {!compact && <RulesHelp label="出招怎么看" className="text-button move-help" />}
          <button className="button subtle" onClick={() => toggleAll(true)}>
            全部展开
          </button>
          <button className="button subtle" onClick={() => toggleAll(false)}>
            全部收起
          </button>
        </div>
      </div>
      {!compact && <RuleNotes items={baselineWarnings} />}
      {!renderMove && !compact && (
        <>
          <p className="move-book-hint">
            收藏整套武学，可在概览查看其中全部已学招式。点开一招核对完整条件；面板伤害未扣目标防御与格挡。
          </p>
          <div className="move-book-tools">
            <label className="field">
              <span>搜索武学、招式或效果</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例如：寒门笔法、倒地、书生"
              />
            </label>
            <label className="field">
              <span>招式类型</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {[
                  "全部",
                  ...new Set(
                    learnedMoves.map((x) => getEntry(x.id)?.moveType ?? "散手"),
                  ),
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <button
              className={"button " + (favorites ? "active-choice" : "")}
              aria-pressed={favorites}
              onClick={() => setFavorites((v) => !v)}
            >
              <Star size={15} />
              {favorites ? "仅看收藏" : "只看收藏"}
            </button>
          </div>
        </>
      )}
      <div className="routine-groups">
        {visible.map(({ group, moves }, i) => {
          const open = isOpen(group.id);
          const contentId = `${uid}-routine-${i}`;
          const origins = [
            ...new Map(
              group.moves.map((l) => {
                const s = learningSource(build, l);
                return [s.label, s] as const;
              }),
            ).values(),
          ];
          return (
            <section className="paper routine-group" key={group.id}>
              <div className="routine-group-header">
              <h3>
                <button
                  className="routine-toggle"
                  aria-expanded={open}
                  aria-controls={contentId}
                  onClick={() =>
                    setExpanded((v) => ({ ...v, [groupKey(group.id)]: !open }))
                  }
                >
                  <span className="routine-chevron">
                    <ChevronDown size={20} />
                  </span>
                  <span className="routine-heading-text">
                    <span className="routine-title">{group.name}</span>
                    <span className="routine-meta">{group.subtitle}</span>
                    <span className="routine-acquisition">
                      {origins.length === 1
                        ? origins[0].label
                        : `${origins.length} 种获得途径 · 展开查看`}
                    </span>
                  </span>
                  <span className="routine-count">
                    {compact
                      ? `已学 ${learnedCounts.get(group.id) ?? group.moves.length} 招`
                      : filtering
                        ? `匹配 ${moves.length} / 已学 ${group.moves.length} 招`
                        : group.entry
                          ? `已学 ${group.moves.length} / ${group.total} 招`
                          : `${group.moves.length} 招`}
                    <span>
                      {group.entry
                        ? contentPack.sources[group.entry.source.book]
                        : "独立条目"}
                    </span>
                  </span>
                </button>
              </h3>
              {onFavorite && group.entry && <button
                className="button routine-favorite"
                disabled={favoriteDisabled}
                aria-label={`${isFavoriteMove(build, group.id) ? "取消收藏" : "收藏"}整套《${group.name}》`}
                aria-pressed={isFavoriteMove(build, group.id)}
                onClick={() => onFavorite(group.id)}
              >
                <Star size={17} fill={isFavoriteMove(build, group.id) ? "currentColor" : "none"} />
                {isFavoriteMove(build, group.id) ? "已收藏" : "收藏整套"}
              </button>}
              </div>
              {!open && (
                <p className="routine-collapsed-names">
                  {moves
                    .map((l) => getEntry(l.id)?.name ?? "待核对招式")
                    .join(" · ")}
                </p>
              )}
              <div id={contentId} hidden={!open}>
                <div className="routine-context">
                  <details className="routine-origins">
                    <summary>获得方式</summary>
                    {origins.map((source) => (
                      <div key={source.label}>
                        <b>{source.label}</b>
                        <p>{source.detail}</p>
                        <small>
                          涉及：
                          {group.moves
                            .filter(
                              (l) =>
                                learningSource(build, l).label === source.label,
                            )
                            .map((l) => getEntry(l.id)?.name ?? l.id)
                            .join("、")}
                        </small>
                        {source.entry && (
                          <button
                            className="text-button"
                            onClick={() => onDetail(source.entry!)}
                          >
                            查看
                            {source.entry.kind === "background"
                              ? "身世"
                              : "武学"}
                            依据 →
                          </button>
                        )}
                      </div>
                    ))}
                  </details>
                  {group.entry && (
                    <button
                      className="text-button"
                      aria-label={`查看《${group.name}》武学说明 · ${sourceLabel(group.entry)}`}
                      onClick={() => onDetail(group.entry!)}
                    >
                      武学原文 →
                    </button>
                  )}
                </div>
                {group.entry?.text.includes("\n·") && (
                  <div className="routine-shared-rule">
                    <b>全套共用规则</b>
                    <p>
                      {group.entry.text
                        .slice(group.entry.text.indexOf("\n·") + 2)
                        .replace(/\n/g, "")}
                    </p>
                    {group.entry.id === "expansion-routine-d81524858dfa" && (
                      <small>书写等级 × 2 的加成已计入下方基础伤害。</small>
                    )}
                  </div>
                )}
                <div className="routine-move-list">
                  {moves.map((item) =>
                    renderMove && !getEntry(item.id)?.grantedBy ? (
                      <div key={item.id}>{renderMove(item)}</div>
                    ) : (
                      <MoveQuickRow
                        key={item.id}
                        build={build}
                        item={item}
                        rules={rules}
                        onDetail={onDetail}
                        onFavorite={group.entry ? undefined : onFavorite}
                        favoriteDisabled={favoriteDisabled}
                        onStance={onStance}
                        activeStance={activeStance}
                        baselineWarnings={baselineWarnings}
                      />
                    ),
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {!shown && (
        <div className="paper panel">
          <h3>
            {learnedMoves.length ? "没有找到符合条件的招式" : "还没有学会招式"}
          </h3>
          <p className="muted">
            {learnedMoves.length
              ? "可以清除筛选，回到全部武学。"
              : "选择一套武学，或逐招加入；这里会按所属武学整理。"}
          </p>
          {learnedMoves.length ? (
            <button
              className="button"
              onClick={() => {
                setQuery("");
                setType("全部");
                setFavorites(false);
              }}
            >
              清除筛选
            </button>
          ) : (
            onAdd && (
              <button className="button" onClick={onAdd}>
                去选择武学
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function MoveQuickRow({
  build,
  item,
  rules,
  onDetail,
  onFavorite,
  onStance,
  activeStance,
  favoriteDisabled,
  baselineWarnings,
}: {
  build: Build;
  item: Learned;
  rules?: Rulings;
  onDetail: (e: Entry) => void;
  onFavorite?: (id: string) => void;
  onStance?: (id: string) => void;
  activeStance?: string;
  favoriteDisabled: boolean;
  baselineWarnings: string[];
}) {
  const entry = getEntry(item.id);
  if (!entry)
    return (
      <div className="move-unavailable">
        此招资料暂缺（{item.id}），请在构筑中核对，原记录已保留。
      </div>
    );
  const move = calculateMove(build, item.id, item.level, rules);
  const p = movePresentation(entry, move, build);
  const ownNotes = ruleNotes(move.warnings, { baseline: baselineWarnings, entry, hideShared: true });
  return (
    <div className="move-quick-row" data-move-type={entry.moveType}>
      {onFavorite && (
        <button
          className="icon-button quick-favorite"
          disabled={favoriteDisabled}
          aria-label={`${isFavoriteMove(build, item.id) ? "取消收藏" : "收藏"}${entry.name}`}
          aria-pressed={isFavoriteMove(build, item.id)}
          onClick={() => onFavorite(item.id)}
        >
          <Star
            size={17}
            fill={isFavoriteMove(build, item.id) ? "currentColor" : "none"}
          />
        </button>
      )}
      <details className="move-quick-details">
        <summary>
          <span className="quick-top">
            <span className="quick-name">
              <span className="quick-type">
                <RuleTerm topic={topicForMoveType(entry.moveType)} label={entry.moveType ?? (entry.lightness ? "轻功" : "散手")} />
              </span>
              <b>{entry.name}</b>
              <small>{rankLabel(entry,item.level)}</small>
            </span>
            <span className="quick-numbers">
              {ownNotes.some(n=>n.kind==="attention")&&<small className="partial-result">有使用条件待确认</small>}
              {entry.moveType === "架招" ? (
                <span>
                  格挡{" "}
                  <strong>
                    <NumberHelp help={explainMove(move, "block", rules)}>
                      {move.block}
                    </NumberHelp>
                  </strong>
                </span>
              ) : move.damageType !== "none" ? (
                <>
                  <span>
                    {damageNames[move.damageType]}{" "}
                    <strong>
                      <NumberHelp help={explainMove(move, "damage", rules)}>
                        {move.damage ?? "待裁定"}
                      </NumberHelp>
                    </strong>
                  </span>
                  {move.critical !== null && (
                    <span>
                      暴击{" "}
                      <b>
                        <NumberHelp help={explainMove(move, "critical", rules)}>
                          {move.critical}
                        </NumberHelp>
                      </b>
                    </span>
                  )}
                </>
              ) : (
                <span>
                  {p.primary ? (
                    <>
                      {p.primary.label} <strong>{p.primary.value}</strong>
                    </>
                  ) : (
                    "辅助效果"
                  )}
                </span>
              )}
              <span>
                消耗{" "}
                <b>
                  <NumberHelp help={explainMove(move, "cost", rules)}>
                    {p.cost}
                  </NumberHelp>
                </b>
              </span>
            </span>
          </span>
          <span className="quick-requirement">
            {p.affinity} · 需求：{p.requirement}
            {p.target ? ` · 对象：${p.target}` : ""}
            {p.duration ? ` · ${p.duration}` : ""}
          </span>
          <span className="quick-effect">{p.headline}</span>
          {p.trigger && <span className="quick-condition">{p.trigger}</span>}
          {p.conditional && (
            <span className="quick-condition">{p.conditional}</span>
          )}
          {p.restrictions.map((text) => (
            <span className="quick-condition" key={text}>
              {text}
            </span>
          ))}
          <span className="quick-foot">
            <span>
              <RuleTerm topic="actions" label={p.action} /> · {p.range}
            </span>
            <span className="quick-expand">
              <span className="when-closed">展开说明</span>
              <span className="when-open">收起说明</span>
              <ChevronDown size={14} />
            </span>
          </span>
        </summary>
        <div className="quick-expanded">
          <MoveReference
            build={build}
            id={item.id}
            level={item.level}
            rules={rules}
            onDetail={onDetail}
            baselineWarnings={baselineWarnings}
            embedded
          />
          <p className="quick-provenance">
            获得方式：{learningSource(build, item).label}
          </p>
        </div>
      </details>
      {entry.moveType === "架招" && onStance && <div className="quick-stance-action">
        <button className="button" onClick={() => onStance(item.id)}>{activeStance === item.id ? "当前架招 · 查看／更换" : "记录为当前架招"}</button>
      </div>}
    </div>
  );
}
