"use client";
import { contentPack } from "@/lib/content-pack";
import { ReferenceDrawer } from "./reference-drawer";
import {
  addEntry,
  addPossession,
  catalog,
  innerRanks,
  maxRank,
  rankLabel,
  ranks,
  sourceLabel,
  weaponOf,
  xpCost,
} from "@/lib/catalog";
import {
  calculateCharacter,
  calculateMove,
  emptyBuild,
  learningIssues,
} from "@/lib/rules";
import { changeDraftBackground } from "@/lib/onboarding";
import { type Entry } from "@/lib/types";
import {
  canTrialEntry,
  filterLibrary,
  learnedSummary,
  libraryExcerpt,
  libraryLabel,
  libraryNodes,
  librarySection,
  librarySections,
  matchingMoves,
  moveBrowseFacts,
  routineMoves,
  type LibraryNode,
  type LibrarySection,
} from "@/lib/library-index";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "./app-context";
import { Choice, EntryMeta, StatGrid, Warnings } from "./common";
import { EquipmentSummary, MoveReference } from "./reference-card";
export function Library() {
  const a = useApp();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<LibrarySection | "all">("inner");
  const [filters, setFilters] = useState({
    book: "",
    grade: "",
    affinity: "",
    sect: "",
    weapon: "",
    itemCategory: "",
  });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [moreFilters, setMoreFilters] = useState(false);
  const [moreSections, setMoreSections] = useState(false);
  const build = a.draft?.build ?? a.character?.build;
  const searchResults = useMemo(() => filterLibrary({ query }), [query]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        librarySections.map((s) => [
          s.id,
          searchResults.filter((n) => n.section === s.id).length,
        ]),
      ),
    [searchResults],
  );
  const found = useMemo(
    () => filterLibrary({ query, section, ...filters }),
    [query, section, filters],
  );
  const available = libraryNodes.filter(
    (n) => section === "all" || n.section === section,
  );
  const optionsFor = (key: "grade" | "affinity" | "sect" | "weapon") =>
    [
      ...new Set(
        available
          .flatMap((n) => [n.entry, ...n.moves])
          .map((e) => (key === "weapon" ? weaponOf(e) : (e[key] ?? "")))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "zh"));
  const current = found.slice(page * 24, (page + 1) * 24);
  const selected = librarySections.find((s) => s.id === section);
  const clearFilters = () => {
    setFilters({
      book: "",
      grade: "",
      affinity: "",
      sect: "",
      weapon: "",
      itemCategory: "",
    });
    setPage(0);
  };
  const chooseSection = (id: LibrarySection | "all") => {
    setSection(id);
    clearFilters();
  };
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPage(0);
  };
  const filterCount = Object.values(filters).filter(Boolean).length;
  const isOpen = (node: LibraryNode) =>
    expanded[`${query}:${node.entry.id}`] ??
    (!!query.trim() && matchingMoves(node, query).length > 0);
  const toggle = (node: LibraryNode) =>
    setExpanded((old) => ({
      ...old,
      [`${query}:${node.entry.id}`]: !isOpen(node),
    }));
  const openAll = (open: boolean) =>
    setExpanded((old) => ({
      ...old,
      ...Object.fromEntries(
        current
          .filter((n) => n.moves.length)
          .map((n) => [`${query}:${n.entry.id}`, open]),
      ),
    }));
  return (
    <div className="reference-library">
      <div className="page-heading library-heading">
        <div>
          <p className="eyebrow">藏经阁 · 正式书与拓展书</p>
          <h1>资料库</h1>
          <p className="muted">内功看修炼，武学看套路，招式在套路里找。</p>
        </div>
        <BookOpen size={30} />
      </div>
      <div className="library-search-bar paper">
        <label className="field search-field">
          <span>搜索功法、招式或效果</span>
          <div>
            <Search size={18} />
            <input
              value={query}
              aria-label="搜索功法、招式或效果"
              placeholder="如：阳重三叠、太极、回复内力"
              onChange={(e) => {
                setQuery(e.target.value);
                setSection(e.target.value.trim() ? "all" : "inner");
                clearFilters();
              }}
            />
            {query && (
              <button
                className="library-clear"
                aria-label="清除搜索"
                onClick={() => {
                  setQuery("");
                  chooseSection("inner");
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </label>
        <div className="library-context">
          <span>{a.draft ? "试配对象" : "当前角色"}</span>
          <b>{build?.name || "尚未选择角色"}</b>
          <button
            className="text-button"
            onClick={() =>
              a.draft ? a.setBuilderOpen(true) : a.startDraft(a.character)
            }
          >
            {build ? "查看构筑 →" : "新建试配 →"}
          </button>
        </div>
      </div>
      <div className="library-browser">
        <nav className="library-navigation" aria-label="资料分类">
          {query.trim() && (
            <button
              className={section === "all" ? "selected" : ""}
              onClick={() => chooseSection("all")}
              aria-current={section === "all" ? "true" : undefined}
            >
              <span>全部搜索结果</span>
              <small>{searchResults.length}</small>
            </button>
          )}
          {["功法", "人物与物品", "规则查阅"]
            .filter(
              (group) =>
                !query.trim() ||
                librarySections.some(
                  (s) => s.group === group && counts[s.id] > 0,
                ),
            )
            .map((group) => (
              <div
                className={`library-nav-group ${group !== "功法" && !moreSections && !query.trim() ? "library-secondary-collapsed" : ""}`}
                key={group}
              >
                <h2>{group}</h2>
                <div>
                  {librarySections
                    .filter(
                      (s) =>
                        s.group === group &&
                        (!query.trim() || counts[s.id] > 0),
                    )
                    .map((s) => (
                      <button
                        key={s.id}
                        className={section === s.id ? "selected" : ""}
                        onClick={() => chooseSection(s.id)}
                        aria-current={section === s.id ? "true" : undefined}
                      >
                        <span>{s.label}</span>
                        <small>{counts[s.id]}</small>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          {!query.trim() && (
            <button
              className="library-more-sections"
              aria-expanded={moreSections}
              onClick={() => setMoreSections((v) => !v)}
            >
              {moreSections ? "收起其他分类" : "人物、物品与规则"}
              <ChevronDown size={14} />
            </button>
          )}
        </nav>
        <section className="library-results" aria-label="资料结果">
          <div className="library-section-heading">
            <div>
              <h2>
                {selected?.label ?? "搜索结果"}{" "}
                <small>
                  {found.length}
                  {selected?.unit ?? "项"}
                </small>
              </h2>
              <p>
                {selected?.description ??
                  "按资料类别展示；搜索到的单招保留所属武学。"}
              </p>
            </div>
            <button
              className="button"
              onClick={() => setMoreFilters((v) => !v)}
              aria-expanded={moreFilters}
            >
              <SlidersHorizontal size={16} />
              筛选{filterCount ? ` · ${filterCount}` : ""}
            </button>
          </div>
          {moreFilters && (
            <div className="library-filter-panel paper">
              <Choice
                label="来源"
                value={filters.book}
                onChange={(v) => updateFilter("book", v)}
                options={[
                  { value: "", label: "全部来源" },
                  { value: "core", label: contentPack.sources.core },
                  { value: "expansion", label: contentPack.sources.expansion },
                ]}
              />
              {(["sect", "grade", "affinity", "weapon"] as const)
                .filter((key) => optionsFor(key).length > 0)
                .map((key) => (
                  <Choice
                    key={key}
                    label={
                      {
                        sect: "门派",
                        grade: "品级 / 类别",
                        affinity: "属性",
                        weapon: "武器",
                      }[key]
                    }
                    value={filters[key]}
                    onChange={(v) => updateFilter(key, v)}
                    options={[
                      { value: "", label: "全部" },
                      ...optionsFor(key).map((value) => ({
                        value,
                        label: value,
                      })),
                    ]}
                  />
                ))}
              {section === "equipment" && (
                <Choice
                  label="物品分类"
                  value={filters.itemCategory}
                  onChange={(v) => updateFilter("itemCategory", v)}
                  options={[
                    "",
                    "武器",
                    "防具与饰物",
                    "药物与消耗品",
                    "工具与其他道具",
                  ].map((value) => ({ value, label: value || "全部物品" }))}
                />
              )}
            </div>
          )}
          {filterCount > 0 && (
            <div className="library-filter-chips">
              {Object.entries(filters)
                .filter(([, v]) => v)
                .map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() =>
                      updateFilter(key as keyof typeof filters, "")
                    }
                    aria-label={`移除筛选 ${value}`}
                  >
                    {(
                      { core: "正式书", expansion: "拓展书" } as Record<
                        string,
                        string
                      >
                    )[value] ?? value}
                    <X size={13} />
                  </button>
                ))}
              <button onClick={clearFilters}>清除筛选</button>
            </div>
          )}
          {!!current.some((n) => n.moves.length) && (
            <div className="library-fold-actions">
              <span>展开套路后查看单招</span>
              <button className="text-button" onClick={() => openAll(true)}>
                展开本页
              </button>
              <button className="text-button" onClick={() => openAll(false)}>
                收起本页
              </button>
            </div>
          )}
          {(section === "all"
            ? librarySections.filter((s) =>
                current.some((n) => n.section === s.id),
              )
            : [selected!]
          ).map((s) => (
            <div className="library-result-group" key={s.id}>
              {section === "all" && (
                <h3>
                  {s.label}{" "}
                  <span>
                    {found.filter((n) => n.section === s.id).length}
                    {s.unit}
                  </span>
                </h3>
              )}
              <div className="library-entry-grid">
                {current
                  .filter((n) => n.section === s.id)
                  .map((node) => (
                    <LibraryCard
                      key={node.entry.id}
                      node={node}
                      query={query}
                      open={isOpen(node)}
                      toggle={() => toggle(node)}
                    />
                  ))}
              </div>
            </div>
          ))}
          {!found.length && (
            <div className="empty-character paper">
              <h3>没有找到符合条件的{selected?.label ?? "资料"}</h3>
              <p>
                {query
                  ? `试试缩短“${query}”，或到其他分类中查找。`
                  : "可以减少筛选条件后再找。"}
              </p>
              <div className="actions">
                {filterCount > 0 && (
                  <button className="button" onClick={clearFilters}>
                    清除筛选
                  </button>
                )}
                {query && section !== "all" && (
                  <button
                    className="button"
                    onClick={() => chooseSection("all")}
                  >
                    搜索整个资料库
                  </button>
                )}
              </div>
            </div>
          )}
          {found.length > 24 && (
            <div className="pagination">
              <button
                className="button"
                disabled={!page}
                onClick={() => {
                  setPage((p) => p - 1);
                  document
                    .querySelector(".library-results")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                上一页
              </button>
              <span>
                第 {page + 1} / {Math.ceil(found.length / 24)} 页
              </span>
              <button
                className="button"
                disabled={(page + 1) * 24 >= found.length}
                onClick={() => {
                  setPage((p) => p + 1);
                  document
                    .querySelector(".library-results")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                下一页
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function LibraryCard({
  node,
  query,
  open,
  toggle,
}: {
  node: LibraryNode;
  query: string;
  open: boolean;
  toggle: () => void;
}) {
  const a = useApp();
  const e = node.entry;
  const build = a.draft?.build ?? a.character?.build;
  const learned = learnedSummary(node, build);
  const matches = matchingMoves(node, query);
  const moves = [...node.moves].sort(
    (x, y) => Number(matches.includes(y)) - Number(matches.includes(x)),
  );
  const stageNames = e.stages?.map((s) => innerRanks[s.stage]);
  return (
    <article
      className={`paper library-entry ${node.moves.length ? "library-routine" : ""}`}
    >
      <div className="library-entry-meta">
        <span>
          {[e.grade, e.sect, e.affinity].filter(Boolean).join(" · ") ||
            libraryLabel(e)}
        </span>
        <small>{contentPack.sources[e.source.book]}</small>
      </div>
      <div className="library-entry-title">
        <button onClick={() => a.setDetail(e)}>
          <h3>{e.name}</h3>
        </button>
        {learned && <span className="library-learned">{learned}</span>}
        {!learned && build && a.campaign && canTrialEntry(e) && (
          <small className="muted">
            {learningIssues(build, e, a.campaign.rules).length
              ? learningIssues(build, e, a.campaign.rules)[0]
              : "符合已支持的学习条件"}
          </small>
        )}
      </div>
      {node.moves.length > 0 ? (
        <>
          <p className="library-requirement">
            {e.requirement?.split(/属性[:：]/)[0] || "武器需求见完整说明"}
          </p>
          <div className="library-type-summary">
            {[...new Set(node.moves.map((m) => m.grade))].map((g) => (
              <span key={g}>
                {g} {node.moves.filter((m) => m.grade === g).length}招
              </span>
            ))}
            {[...new Set(node.moves.map((m) => m.moveType ?? "其他"))].map(
              (type) => (
                <span key={type}>
                  {type}{" "}
                  <b>
                    {
                      node.moves.filter((m) => (m.moveType ?? "其他") === type)
                        .length
                    }
                  </b>
                </span>
              ),
            )}
          </div>
          {!open && (
            <p className="library-move-names">
              {node.moves.map((m) => m.name).join(" · ")}
            </p>
          )}
          <div className="library-card-actions">
            <button
              className="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={`moves-${e.id}`}
            >
              <ChevronDown size={16} className={open ? "rotate-open" : ""} />
              {open ? "收起" : "展开"} {node.moves.length} 招
              {matches.length ? ` · 匹配 ${matches.length} 招` : ""}
            </button>
            <button className="text-button" onClick={() => a.setDetail(e)}>
              整套说明与试配 →
            </button>
          </div>
          {open && (
            <div className="library-move-list" id={`moves-${e.id}`}>
              {moves.map((m) => (
                <button
                  className={matches.includes(m) ? "search-hit" : ""}
                  key={m.id}
                  onClick={() => a.setDetail(m)}
                >
                  <span className={`library-move-type type-${m.moveType}`}>
                    {m.moveType ?? "招式"}
                  </span>
                  <span>
                    <strong>{m.name}</strong>
                    <small>
                      {[
                        ...moveBrowseFacts(m),
                        build?.moves.some((l) => l.id === m.id)
                          ? `已学 · ${ranks[build.moves.find((l) => l.id === m.id)!.level]}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    <span className="library-move-effect">
                      领悟：{libraryExcerpt(m)}
                    </span>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {e.kind === "inner" ? (
            <>
              <p className="library-stages">{stageNames?.join(" → ")}</p>
              <p className="library-requirement">
                学习门槛：悟性{" "}
                {e.insight ??
                  (e.grade === "天级" ? 10 : e.grade === "地级" ? 4 : 1)}
              </p>
              <p className="library-excerpt">
                {(
                  e.effects?.["1"] ??
                  e.effects?.["2"] ??
                  "运功属性与阶段效果见详情"
                ).replace(/\n/g, "")}
              </p>
              {e.effects && Object.keys(e.effects).length > 0 && (
                <details className="library-inner-effects">
                  <summary>运功特效 · 按阶段查看</summary>
                  {Object.entries(e.effects).map(([stage, text]) => (
                    <p key={stage}>
                      <b>{innerRanks[Number(stage)]}</b>
                      {text}
                    </p>
                  ))}
                </details>
              )}
              <p className="library-permanent">
                <b>修满永久</b>
                {e.permanent || "原书未列永久收益"}
              </p>
            </>
          ) : e.kind === "equipment" ? (
            <EquipmentSummary entry={e} />
          ) : e.music ? (
            <>
              <p className="library-music-info">
                通读 {e.music.learnCost} 修为 · 演奏难度 {e.music.difficulty}
              </p>
              <p className="library-excerpt">
                {e.music.baseEffect || libraryExcerpt(e)}
              </p>
              <p className="library-requirement">
                音阶条件：{e.music.sequence}
              </p>
            </>
          ) : (
            <p className="library-excerpt">
              {libraryExcerpt(e) || "展开查看规则说明。"}
            </p>
          )}
          {e.kind === "routine" && !canTrialEntry(e) && (
            <p className="library-readonly">
              {node.section === "formation"
                ? "阵法与战法 · 原文查阅"
                : node.section === "lightness"
                  ? "轻功原文 · 学习资料待核对"
                  : "原文保留 · 招式拆分或归属待核对"}
            </p>
          )}
          <button
            className="library-open-detail text-button"
            onClick={() => a.setDetail(e)}
          >
            {e.kind === "inner"
              ? "查看阶段效果与角色变化"
              : canTrialEntry(e)
                ? "查看效果与试配"
                : "查看完整说明"}
            <ArrowUpRight size={16} />
          </button>
        </>
      )}
    </article>
  );
}
export function EntryDetail() {
  const a = useApp();
  return (
    <ReferenceDrawer
      open={!!a.detail}
      close={() => a.setDetail(null)}
      title={a.detail?.name ?? "资料详情"}
      description="查看原书说明与来源。试配针对当前操作角色，道具持有与穿戴分别记录。"
    >
      {a.detail && <DetailBody key={a.detail.id} entry={a.detail} />}
    </ReferenceDrawer>
  );
}
function DetailBody({ entry: e }: { entry: Entry }) {
  const a = useApp();
  const initialBuild = a.draft?.build ?? a.character?.build;
  const learnedLevel = [
    ...(initialBuild?.inner ?? []),
    ...(initialBuild?.moves ?? []),
  ].find((l) => l.id === e.id)?.level;
  const [level, setLevel] = useState(learnedLevel ?? (e.music ? 3 : 1));
  const [run, setRun] = useState(
    e.kind === "inner" && initialBuild?.activeInner !== e.id,
  );
  const base = a.draft?.build ?? a.character?.build ?? emptyBuild();
  const after =
    e.kind === "background" && (a.draft?.isNew ?? !a.character)
      ? changeDraftBackground(base, e.id, a.draft?.backgroundGrant).build
      : e.kind === "equipment"
        ? addPossession(base, e)
        : addEntry(base, e, level);
  // Preview an explicitly selected stage; the add action itself never downgrades known learning.
  if (e.kind === "inner" || e.kind === "move" || e.kind === "special") {
    const l = (e.kind === "inner" ? after.inner : after.moves).find(
      (x) => x.id === e.id,
    );
    if (l) l.level = level;
  }
  if (run && e.kind === "inner") after.activeInner = e.id;
  const c = calculateCharacter(after);
  const before = calculateCharacter(base);
  const rules = a.campaign?.rules;
  const issues = rules ? learningIssues(base, e, rules) : [];
  const moves = routineMoves(e);
  const selectable = canTrialEntry(e);
  const parent = e.parentId
    ? catalog.find((p) => p.id === e.parentId)
    : undefined;
  const page = catalog.find(
    (x) =>
      x.kind === "reference" &&
      x.source.book === e.source.book &&
      x.source.pdfPage === e.source.pdfPage,
  );
  const apply = () => {
    a.trial(e, level);
    if (run && e.kind === "inner") {
      const d = a.draft ?? {
        id: a.character?.id ?? crypto.randomUUID(),
        revision: a.character?.revision ?? 0,
        build: base,
        isNew: !a.character,
      };
      a.setDraft({
        ...d,
        build: { ...addEntry(base, e, level), activeInner: e.id },
      });
    }
    a.setDetail(null);
    a.setBuilderOpen(true);
  };
  return (
    <div
      className={`detail-layout ${selectable ? "" : "library-reading-detail"}`}
    >
      {selectable && (
        <div className="mobile-detail-action">
          <span>
            气血 {c.hpMax - before.hpMax >= 0 ? "+" : ""}
            {c.hpMax - before.hpMax} · 内力{" "}
            {c.mpMax - before.mpMax >= 0 ? "+" : ""}
            {c.mpMax - before.mpMax}
          </span>
          <button className="button primary" onClick={apply}>
            {e.kind === "routine" ? "整套加入草稿" : "加入草稿并查看"}
          </button>
        </div>
      )}
      <section>
        <nav className="library-detail-path" aria-label="资料路径">
          <span>{libraryLabel(parent ?? e)}</span>
          {parent && (
            <>
              <span>›</span>
              <button
                className="text-button"
                onClick={() => a.setDetail(parent)}
              >
                <ArrowLeft size={14} />
                {parent.name}
              </button>
            </>
          )}
          <span>›</span>
          <b>{e.name}</b>
        </nav>
        <EntryMeta entry={e} />
        {selectable && !a.draft && !a.character && (
          <p className="inset muted">
            尚未选择角色。下方以空白角色预览；实际伤害和属性需选择角色或建立试配后查看。
          </p>
        )}
        {e.sect && <p className="muted">{e.sect}</p>}
        {e.kind === "routine" && !selectable && (
          <p className="inset muted">
            {librarySection(e) === "formation"
              ? "这是多人阵法与战法的规则，供现场查阅与手动处理。"
              : "这份原文的招式拆分或学习资料尚待核对，暂不提供整套学习。可在下方查看所在原书页全文。"}
          </p>
        )}
        {e.music && (
          <div className="inset">
            <b>乐谱 · 通读后精通</b>
            <p>
              通读需 {e.music.learnCost} 修为 · 演奏难度 {e.music.difficulty} ·{" "}
              {e.music.bookGrade}品乐谱
            </p>
            <p>
              施展前先成功演奏；对应乐师身份条件请与 DM
              核对。书籍持有和已学招式分别记录。
            </p>
          </div>
        )}
        {!!e.relatedIds?.length && (
          <details className="disclosure">
            <summary>关联乐谱与招式</summary>
            {e.relatedIds.map((id) => {
              const linked = catalog.find((x) => x.id === id);
              return linked ? (
                <button
                  key={id}
                  className="reference-row"
                  onClick={() => a.setDetail(linked)}
                >
                  {linked.name} · {libraryLabel(linked)} →
                </button>
              ) : null;
            })}
          </details>
        )}
        {e.requirement && (
          <p className="requirement">学习 / 施展条件：{e.requirement}</p>
        )}
        {selectable &&
          ["inner", "move", "routine", "special"].includes(e.kind) && (
            <Choice
              label={
                e.kind === "routine"
                  ? "整套预览阶段（各招可独立调整）"
                  : "预览修炼阶段"
              }
              value={String(level)}
              onChange={(s) => setLevel(Number(s))}
              options={Array.from({ length: maxRank(e) }, (_, i) => ({
                value: String(i + 1),
                label: rankLabel(e, i + 1),
              })).filter((x) => !e.music || x.value === "3")}
            />
          )}
        {e.kind === "inner" && (
          <div className="stage-table">
            <table>
              <thead>
                <tr>
                  <th>阶段</th>
                  {["力", "身", "体", "内", "气", "神"].map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.stages?.map((s) => (
                  <tr
                    className={s.stage === level ? "chosen" : ""}
                    key={s.stage}
                  >
                    <td>{innerRanks[s.stage]}</td>
                    {Object.values(s.stats).map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="permanent">
              修满永久收益：{e.permanent ?? "书中未列永久加成"}
            </p>
          </div>
        )}
        {e.kind === "equipment" && <EquipmentSummary entry={e} />}
        {(e.kind === "move" || e.kind === "special") && (
          <MoveReference
            build={after}
            id={e.id}
            level={level}
            rules={rules}
            baselineWarnings={c.warnings}
          />
        )}
        {moves.length > 0 && (
          <div className="routine-moves">
            {moves.map((m) => (
              <button
                key={m.id}
                className="reference-row"
                onClick={() => a.setDetail(m)}
              >
                <span>
                  <strong>{m.name}</strong>
                  <small>
                    {m.moveType} ·{" "}
                    {ranks[base.moves.find((x) => x.id === m.id)?.level ?? 0] ||
                      "未学"}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        )}
        <details
          className="disclosure"
          open={!["move", "special", "equipment"].includes(e.kind)}
        >
          <summary>完整规则说明</summary>
          <p className="rule-text">{e.text}</p>
        </details>
        <div className="source">
          {sourceLabel(e)} · PDF 第 {e.source.pdfPage} 页 · 版本{" "}
          {e.source.version}
          {page && page.id !== e.id && (
            <button className="text-button" onClick={() => a.setDetail(page)}>
              查看所在原书页全文 →
            </button>
          )}
        </div>
      </section>
      {selectable && (
        <aside className="detail-preview">
          <p className="eyebrow">{base.name || "新侠士"} · 变化预览</p>
          <StatGrid result={c} previous={before} />
          <Warnings items={c.warnings} title="角色条件效果" />
          <div className="comparison">
            <span>气血上限</span>
            <b>
              {before.hpMax} → {c.hpMax}
            </b>
            <span>内力上限</span>
            <b>
              {before.mpMax} → {c.mpMax}
            </b>
            <span>悟性</span>
            <b>
              {before.insight} → {c.insight}
            </b>
          </div>
          {selectable &&
            ["inner", "move", "special", "routine"].includes(e.kind) && (
              <p>
                修到此阶段的累计投入{" "}
                <b>
                  {e.kind === "routine"
                    ? moves.reduce((n, m) => n + xpCost(m, level), 0)
                    : xpCost(e, level)}
                </b>
              </p>
            )}
          {e.kind === "inner" && (
            <Choice
              label="预览方式"
              value={run ? "run" : "learn"}
              onChange={(s) => setRun(s === "run")}
              options={[
                { value: "run", label: "学会并设为运行内功" },
                { value: "learn", label: "只学会，维持当前内功" },
              ]}
            />
          )}
          <p className="muted">
            累计投入不是本次要再扣的修为。已学阶段的新增成本会在应用前核对。
          </p>
          {learnedLevel && level < learnedLevel && (
            <p className="warning-box">
              正在预览较低阶段；「加入」不会降低你已经学会的阶段。主动调整请到构筑页。
            </p>
          )}
          <Warnings items={issues} title="学习条件" />
          {selectable && (
            <button
              id="detail-apply"
              className="button primary full-width"
              onClick={apply}
            >
              <Plus size={16} />
              {e.kind === "routine" ? "整套加入试配草稿" : "加入试配草稿"}
            </button>
          )}
          <p className="muted" role="status">
            {a.draft
              ? `正在试配：${a.draft.build.name || "新侠士"}。`
              : "预览不会修改角色。"}{" "}
            加入后在构筑页核对并应用。
          </p>
          {a.draft && (
            <button
              className="button full-width"
              onClick={() => {
                a.setDetail(null);
                a.setBuilderOpen(true);
              }}
            >
              查看草稿并应用 →
            </button>
          )}
          {base.moves.length > 0 && (
            <details className="disclosure">
              <summary>常用招式影响</summary>
              {base.moves.slice(0, 8).map((l) => {
                const prev = calculateMove(base, l.id, l.level, rules);
                const next = calculateMove(after, l.id, l.level, rules);
                return (
                  <div className="reference-row" key={l.id}>
                    <span>{prev.name}</span>
                    <b>
                      {prev.damage ?? "待定"} → {next.damage ?? "待定"}
                    </b>
                  </div>
                );
              })}
            </details>
          )}
        </aside>
      )}
    </div>
  );
}
