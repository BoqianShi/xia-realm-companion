"use client";
import { CharacterPrint } from "./character-print";
import { CharacterPortraitEditor } from "./portrait";
import { Portrait } from "./person-portrait";
import { portraitExport } from "@/lib/portraits";
import { RuleNotes } from "./rule-notes";
import { ToneTrack } from "./host-context";
import { GrowthPanel } from "./growth";
import { RulesHelp } from "./rules-help";
import { NumberHelp } from "./number-help";
import { explainStat } from "@/lib/explanations";
import { useEffect, useId, useRef, useState } from "react";
import {
  Copy,
  Download,
  Link as LinkIcon,
  MoreHorizontal,
  Edit3,
} from "lucide-react";
import type { Character } from "@/lib/types";
import { RULES_VERSION } from "@/lib/types";
import { getEntry, effectiveMoves, innerRanks, maxRank, DATA_REVISION } from "@/lib/catalog";
import { activeEffect, calculateCharacter } from "@/lib/rules";
import { useApp } from "./app-context";
import { Calculation, StatGrid, download } from "./common";
import { MoveBook } from "./move-book";
import { EquipmentSummary } from "./reference-card";
import {
  ResourceStrip,
  StanceControl,
  TableStates,
  SkillSheet,
  TableInventory,
  TableNotes,
  TableHistory,
  useTableEditor,
} from "./tabletop";
const tabs = ["概览", "武学", "技能", "行囊", "笔记"] as const;
type Tab = (typeof tabs)[number];
export function PlaySheet({
  ch,
  inspection = false,
}: {
  ch: Character;
  inspection?: boolean;
}) {
  const a = useApp();
  const sheetId = useId();
  const c = calculateCharacter(ch.build);
  const revised = [...ch.build.inner, ...ch.build.moves].filter(
    (l) => getEntry(l.id)?.dataRevision === DATA_REVISION,
  );
  const hasMusic = effectiveMoves(ch.build).some((m) => !!getEntry(m.id)?.music);
  const [tab, setTab] = useState<Tab>("概览");
  const scroll = useRef<Partial<Record<Tab, number>>>({});
  const heading = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const t = useTableEditor(ch);
  const [share, setShare] = useState("");
  const [portraitOpen, setPortraitOpen] = useState(false);
  useEffect(() => {
    if (inspection) return;
    const followHash = () => {
      if (location.hash === "#character-moves")
        queueMicrotask(() => setTab("武学"));
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [inspection]);
  const switchTab = (next: Tab) => {
    if (next === tab) return;
    if (inspection) {
      const pane = main.current?.closest<HTMLElement>(".table-card-scroll");
      scroll.current[tab] = pane?.scrollTop ?? 0;
      setTab(next);
      requestAnimationFrame(() => {
        if (pane) pane.scrollTop = scroll.current[next] ?? 0;
      });
      return;
    }
    scroll.current[tab] = window.scrollY;
    setTab(next);
    requestAnimationFrame(() => {
      // Measure the normal-flow container, never the sticky tab bar's moved position.
      const start = main.current
        ? main.current.getBoundingClientRect().top + window.scrollY
        : 0;
      const inset = heading.current
        ? parseFloat(getComputedStyle(heading.current).top) || 0
        : 0;
      window.scrollTo({
        top: scroll.current[next] ?? Math.max(0, start - inset),
        behavior: "instant",
      });
    });
  };
  const favorite = (id: string) => void t.direct({ kind: "pinArt", id });
  return (
    <div className="play-sheet">
      {portraitOpen && <CharacterPortraitEditor ch={ch} close={() => setPortraitOpen(false)} />}
      <header className="sheet-identity">
        <div className="sheet-person">
          {inspection ? <Portrait name={ch.build.name} src={a.campaign?.portraits?.[ch.portraitId ?? ""]} /> : <button className="portrait-edit-button" aria-label={`更换 ${ch.build.name} 的头像`} onClick={() => setPortraitOpen(true)}><Portrait name={ch.build.name} src={a.campaign?.portraits?.[ch.portraitId ?? ""]} /></button>}
          <div>
          <p className="eyebrow">
            {inspection ? "正在查看" : "当前操作角色"} ·{" "}
            {ch.build.kind === "npc" ? "NPC" : ch.build.sect || "江湖侠士"}
          </p>
          <h1>{ch.build.name}</h1>
          <p>
            {getEntry(ch.build.background)?.name ?? "未选身世"} ·{" "}
            {getEntry(ch.build.personality)?.name ?? "未选性格"}
          </p>
          </div>
        </div>
        {!inspection && (
          <details className="sheet-more">
            <summary className="button">
              <MoreHorizontal size={18} />
              更多
            </summary>
            <div className="paper more-menu">
              <button className="button" onClick={() => a.startDraft(ch)}>
                <Edit3 size={15} />
                成长与角色构筑
              </button>
              <CharacterPrint ch={ch} rules={a.campaign?.rules} />
              <button className="button" onClick={() => setPortraitOpen(true)}>更换头像</button>
              <button className="button" onClick={() => a.duplicate(ch)}>
                <Copy size={15} />
                复制角色
              </button>
              <button
                className="button"
                onClick={() => {
                  const url = new URL(location.href);
                  url.search = "";
                  url.searchParams.set("character", ch.id);
                  setShare(url.href);
                }}
              >
                <LinkIcon size={15} />
                分享角色
              </button>
              <button
                className="button"
                onClick={() =>
                  download(ch.build.name + "-人物卡.json", {
                    format: "xia-character-v1",
                    rulesVersion: RULES_VERSION,
                    dataRevision: DATA_REVISION,
                    character: ch,
                    portraits: portraitExport(a.campaign?.portraits, ch.portraitId),
                  })
                }
              >
                <Download size={15} />
                导出 JSON 存档
              </button>
              <RulesHelp className="button subtle" />
            </div>
          </details>
        )}
      </header>
      {!inspection &&
        a.campaign?.hosting?.board.status === "running" &&
        a.campaign?.hosting?.board.units.some(
          (u) => u.characterId === ch.id,
        ) && (
          <button
            className="sheet-turn-link paper"
            onClick={() => a.setView("先攻")}
          >
            <span>
              <b>本场先攻</b> · {a.campaign.hosting.board.title}
              {a.campaign.hosting.board.trackingMode === "turn" && a.campaign.hosting.board.units.find(
                (u) => u.id === a.campaign?.hosting?.board.activeId,
              )?.characterId === ch.id
                ? " · 轮到你了"
                : ""}
            </span>
            <span>查看顺序与轮数 →</span>
          </button>
        )}
      {share && (
        <div className="paper panel">
          <label className="field">
            角色链接
            <input
              readOnly
              value={share}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share);
                a.setNotice("已复制角色链接");
              } catch {
                a.setNotice("请选中并复制链接");
              }
            }}
          >
            复制链接
          </button>
          <button className="text-button" onClick={() => setShare("")}>
            收起
          </button>
        </div>
      )}
      {!inspection && a.draft && (
        <div className="draft-banner">
          <span>构筑草稿 · {a.draft.build.name || "新侠士"}</span>
          <button
            className="text-button"
            onClick={() => a.setBuilderOpen(true)}
          >
            继续 / 应用
          </button>
        </div>
      )}
      {t.editor}
      <div className="sheet-workspace">
        <aside className="sheet-sidebar">
          <section className="paper sheet-resources">
            <div className="section-heading">
              <h3>当前资源</h3>
              <small>点击数字手动记录</small>
            </div>
            <ResourceStrip ch={ch} onEdit={t.start} />
            <StanceControl ch={ch} onEdit={t.start} />
          </section>
          <div className="desktop-table-states">
            <TableStates ch={ch} onEdit={t.start} />
          </div>
          <section className="paper sidebar-loadout">
            <small>运行内功</small>
            <button
              className="reference-row"
              onClick={() =>
                t.start({
                  kind: "loadout",
                  field: "activeInner",
                  value: ch.build.activeInner,
                })
              }
            >
              <b>{getEntry(ch.build.activeInner)?.name ?? "未运行"}</b>
              <span>切换 →</span>
            </button>
            <small>当前持握</small>
            <button
              className="reference-row"
              onClick={() =>
                t.start({
                  kind: "loadout",
                  field: "activeWeapon",
                  value: ch.build.activeWeapon,
                })
              }
            >
              <b>{getEntry(ch.build.activeWeapon)?.name ?? "徒手"}</b>
              <span>更换 →</span>
            </button>
          </section>
        </aside>
        <div className="sheet-main" ref={main}>
          <div
            className="sheet-tabbar"
            role="tablist"
            aria-label="角色卡内容"
            ref={heading}
          >
            {tabs.map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                aria-controls={sheetId + "-panel-" + name}
                id={sheetId + "-tab-" + name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => switchTab(name)}
                onKeyDown={(e) => {
                  const i = tabs.indexOf(name);
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const next =
                      tabs[(i + (e.key === "ArrowRight" ? 1 : 4)) % 5];
                    switchTab(next);
                    document.getElementById(sheetId + "-tab-" + next)?.focus();
                  }
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <section
            hidden={tab !== "概览"}
            role="tabpanel"
            id={sheetId + "-panel-概览"}
            aria-labelledby={sheetId + "-tab-概览"}
          >
            <section className="paper sheet-basics">
              <div className="section-heading">
                <h2>基础面板</h2>
                <small>点数字查看计算说明</small>
              </div>
              <StatGrid result={c} />
              <div className="sheet-checks">
                <div>
                  <span>命中加值</span>
                  <b>
                    外功{" "}
                    <NumberHelp help={explainStat(c, "physicalHit")}>
                      {c.physicalHit}
                    </NumberHelp>{" "}
                    / 内功{" "}
                    <NumberHelp help={explainStat(c, "internalHit")}>
                      {c.internalHit}
                    </NumberHelp>
                  </b>
                  <small>D20＋加值 ≥ 目标闪避</small>
                </div>
                <div>
                  <span>防御</span>
                  <b>
                    外功{" "}
                    <NumberHelp help={explainStat(c, "physicalDefense")}>
                      {c.physicalDefense}
                    </NumberHelp>{" "}
                    / 内功{" "}
                    <NumberHelp help={explainStat(c, "internalDefense")}>
                      {c.internalDefense}
                    </NumberHelp>
                  </b>
                </div>
                <div>
                  <span>暴击门槛</span>
                  <b>
                    外功{" "}
                    <NumberHelp help={explainStat(c, "physicalCrit")}>
                      {c.physicalCrit}
                    </NumberHelp>{" "}
                    / 内功{" "}
                    <NumberHelp help={explainStat(c, "internalCrit")}>
                      {c.internalCrit}
                    </NumberHelp>
                  </b>
                  <small>命中骰原始点数；适用条件见招式</small>
                </div>
                <div>
                  <span>闪避 / 速度</span>
                  <b>
                    <NumberHelp help={explainStat(c, "dodge")}>
                      {c.dodge}
                    </NumberHelp>{" "}
                    /{" "}
                    <NumberHelp help={explainStat(c, "speed")}>
                      {c.speed}
                    </NumberHelp>{" "}
                    米
                  </b>
                </div>
                <div>
                  <span>看破</span>
                  <b>
                    <NumberHelp help={explainStat(c, "lookThrough")}>
                      {c.lookThrough}
                    </NumberHelp>
                  </b>
                </div>
                <div>
                  <span>先攻检定</span>
                  <b>
                    D20＋
                    <NumberHelp help={explainStat(c, "initiative")}>
                      {c.initiative}
                    </NumberHelp>
                  </b>
                </div>
              </div>
              <details className="disclosure">
                <summary>全部属性与计算依据</summary>
                <Calculation result={c} />
              </details>
            </section>
            <div className="mobile-table-states">
              <TableStates ch={ch} onEdit={t.start} />
            </div>
            <RuleNotes items={c.warnings} />
            <MoveBook
              build={ch.build}
              rules={a.campaign?.rules}
              onDetail={a.setDetail}
              onFavorite={favorite}
              onStance={(id) => t.start({ kind: "stance", value: id })}
              activeStance={ch.runtime.stance}
              favoriteDisabled={!a.online || a.busy}
              title="常用武学"
              compact
              onAdd={() => switchTab("武学")}
            />
            <SkillSheet
              ch={ch}
              pinnedOnly
              onPin={(name) => void t.direct({ kind: "pinSkill", name })}
            />
            <div className="sheet-current-effects">
              <section className="paper panel">
                <h3>{getEntry(ch.build.activeInner)?.name ?? "运行内功"}</h3>
                <p>
                  {activeEffect(ch.build).replace(/\n/g, "") ||
                    "当前未列运行特效"}
                </p>
                <small>达到圆满的内功，其已支持的永久收益会计入基础面板。</small>
              </section>
              <section className="paper panel">
                <h3>{getEntry(ch.build.activeWeapon)?.name ?? "徒手"}</h3>
                {getEntry(ch.build.activeWeapon) ? (
                  <EquipmentSummary entry={getEntry(ch.build.activeWeapon)!} />
                ) : (
                  <p>施展徒手武学。</p>
                )}
              </section>
            </div>
            {!!revised.length && (
              <details className="paper panel">
                <summary>资料修订 · {revised.length} 项已学内容有更新</summary>
                <p>
                  当前使用资料修订 {DATA_REVISION}
                  。历史修为和已学阶段保留；不会因分类修正额外学会其他招式。
                </p>
                {revised.map((l) => (
                  <p key={l.id}>
                    <b>{getEntry(l.id)?.name}</b>：
                    {getEntry(l.id)?.review?.note}
                    {l.level > maxRank(getEntry(l.id)!)
                      ? " 当前旧阶段超出可用阶段，请由主持人核对；原记录尚未删除。"
                      : ""}
                  </p>
                ))}
              </details>
            )}
          </section>
          <section
            hidden={tab !== "武学"}
            role="tabpanel"
            id={sheetId + "-panel-武学"}
            aria-labelledby={sheetId + "-tab-武学"}
          >
            <details className="paper panel disclosure">
              <summary>已学内功 · {ch.build.inner.length} 门</summary>
              <p className="muted">
                只有当前运行的内功提供运行效果；达到圆满后，已支持的永久收益才计入面板。
              </p>
              <div className="inventory-list">
                {ch.build.inner.map((item) => (
                  <button
                    className="reference-row"
                    key={item.id}
                    onClick={() => {
                      const entry = getEntry(item.id);
                      if (entry) a.setDetail(entry);
                    }}
                  >
                    <span>
                      <b>{getEntry(item.id)?.name ?? item.id}</b>
                      <small>
                        {innerRanks[item.level]}
                        {ch.build.activeInner === item.id ? " · 运行中" : ""}
                        {item.level >= 3 ? " · 修满" : ""}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </details>
            <div id={inspection ? undefined : "character-moves"}>
              <MoveBook
                build={ch.build}
                rules={a.campaign?.rules}
                onDetail={a.setDetail}
                onFavorite={favorite}
              onStance={(id) => t.start({ kind: "stance", value: id })}
              activeStance={ch.runtime.stance}
                favoriteDisabled={!a.online || a.busy}
                onAdd={() => a.startDraft(ch, 3)}
              />
            </div>
            {hasMusic && <ToneTrack />}
            {!inspection && <GrowthPanel ch={ch} />}
            <button className="button" onClick={() => a.startDraft(ch, 3)}>
              学习与修炼武学
            </button>
          </section>
          <section
            hidden={tab !== "技能"}
            role="tabpanel"
            id={sheetId + "-panel-技能"}
            aria-labelledby={sheetId + "-tab-技能"}
          >
            <SkillSheet
              ch={ch}
              onPin={(name) => void t.direct({ kind: "pinSkill", name })}
            />
          </section>
          <section
            hidden={tab !== "行囊"}
            role="tabpanel"
            id={sheetId + "-panel-行囊"}
            aria-labelledby={sheetId + "-tab-行囊"}
          >
            <TableInventory ch={ch} onEdit={t.start} />
          </section>
          <section
            hidden={tab !== "笔记"}
            role="tabpanel"
            id={sheetId + "-panel-笔记"}
            aria-labelledby={sheetId + "-tab-笔记"}
          >
            <TableNotes ch={ch} onEdit={t.start} />
            <TableHistory ch={ch} />
          </section>
        </div>
      </div>
    </div>
  );
}
