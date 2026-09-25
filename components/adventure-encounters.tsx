"use client";
import { useState } from "react";
import { BookOpen, Check, Download, Search } from "lucide-react";
import {
  adventureEncounters,
  getAdventureEncounter,
  encounterNpc,
  initialEncounterCounts,
  encounterIssues,
  type AdventureEncounter,
} from "@/lib/adventure-encounters";
import { modules, getModule } from "@/lib/modules";
import {
  useHost,
  HostModal,
  useHostDraft,
  DraftConflict,
  useModuleContent,
} from "./host-shared";
import { ModulePeople } from "./module-people";
import { ReferenceDrawer } from "./reference-drawer";

const roles = { opening: "开场", reserve: "候场援军", support: "场外 / 剧情" };
export function EncounterSources({
  encounter: e,
}: {
  encounter: AdventureEncounter;
}) {
  const m = getModule(e.moduleId)!;
  return (
    <span className="encounter-sources">
      {m.title} ·{" "}
      {e.pages.map((p) => (
        <a key={p} href={`${m.pdf}#page=${p}`} target="_blank" rel="noreferrer">
          PDF {p} 页
        </a>
      ))}
    </span>
  );
}
function ActorReference({
  e,
  npcId,
  close,
}: {
  e: AdventureEncounter;
  npcId: string;
  close: () => void;
}) {
  const n = encounterNpc(e.moduleId, npcId)!,
    { data, error } = useModuleContent(e.moduleId);
  return (
    <ReferenceDrawer
      title={n.name}
      close={close}
      description="剧本面板与招式；本场特殊调整另见遭遇备注。"
    >
      {data ? (
        <ModulePeople module={{ ...data, npcs: [n] }} query="" compact />
      ) : (
        <p>{error || "正在打开人物资料…"}</p>
      )}
    </ReferenceDrawer>
  );
}
export function AdventureEncounterLibrary({
  onLoaded,
}: {
  onLoaded?: () => void;
}) {
  const { a, h, send, disabled } = useHost();
  const [moduleId, setModule] = useState("all"),
    [query, setQuery] = useState(""),
    [prepare, setPrepare] = useState<AdventureEncounter | null>(null),
    [inspect, setInspect] = useState<{
      e: AdventureEncounter;
      npcId: string;
    } | null>(null);
  const imported = new Set(h.presets.map((p) => p.sourceId)),
    pending = adventureEncounters.filter((e) => !imported.has(e.id)),
    visible = adventureEncounters.filter(
      (e) =>
        (moduleId === "all" || e.moduleId === moduleId) &&
        `${e.title} ${e.cast.map((c) => c.name).join(" ")} ${e.trigger}`.includes(
          query.trim(),
        ),
    );
  return (
    <section className="encounter-library">
      <div className="paper panel encounter-intro">
        <div>
          <p className="eyebrow">按剧本顺序备团</p>
          <h2>剧本遭遇已排好，开场时选一场</h2>
          <p>
            模组资料 · {adventureEncounters.length}{" "}
            个遭遇与分支。敌人数量、援军、场外人物和出处一并保留。
          </p>
          <small>载入阵容后可一键自动掷先攻；人物资源与入场时机仍由桌上决定。</small>
        </div>
        <button
          className="button primary"
          disabled={disabled || !pending.length}
          onClick={() =>
            void send({ kind: "scriptImport", ids: pending.map((e) => e.id) })
          }
        >
          {pending.length ? <Download size={17} /> : <Check size={17} />}
          {pending.length
            ? `一键导入全部遭遇（${pending.length}）`
            : "全部遭遇已导入"}
        </button>
      </div>
      <div className="encounter-filters">
        <label className="field">
          模组
          <select value={moduleId} onChange={(e) => setModule(e.target.value)}>
            <option value="all">全部模组</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            <Search size={14} /> 找场景或人物
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：狼、牟老、神火观"
          />
        </label>
        <span className="muted">
          已备好 {adventureEncounters.length - pending.length} /{" "}
          {adventureEncounters.length} 场
        </span>
      </div>
      {modules
        .filter((m) => visible.some((e) => e.moduleId === m.id))
        .map((m) => {
          const entries = visible.filter((e) => e.moduleId === m.id),
            missing = adventureEncounters.filter(
              (e) => e.moduleId === m.id && !imported.has(e.id),
            );
          return (
            <section key={m.id} className="encounter-book">
              <div className="host-section-toolbar">
                <h3>
                  {m.title} <small>{entries.length} 场</small>
                </h3>
                <button
                  className="button"
                  disabled={disabled || !missing.length}
                  onClick={() =>
                    void send({
                      kind: "scriptImport",
                      ids: missing.map((e) => e.id),
                    })
                  }
                >
                  {missing.length ? "导入本模组遭遇" : "本模组已备好"}
                </button>
              </div>
              {entries.map((e) => (
                <details key={e.id} className="paper encounter-card">
                  <summary>
                    <div>
                      <span className="encounter-kind">{e.kind}</span>
                      <strong>{e.title}</strong>
                      <p>
                        {e.cast
                          .filter((c) => c.role !== "support")
                          .map(
                            (c) =>
                              `${c.name} ×${c.count ?? "待定"}${c.role === "reserve" ? "（候场）" : c.optional ? "（可选）" : ""}`,
                          )
                          .join(" · ") ||
                          "区域危险 / 场外人物；没有固定敌方先攻位"}
                      </p>
                    </div>
                    <span className="encounter-import-state">
                      {imported.has(e.id) ? "已导入" : "查看阵容"}
                    </span>
                  </summary>
                  <div className="encounter-card-body">
                    {e.trigger && (
                      <p>
                        <b>触发：</b>
                        {e.trigger}
                      </p>
                    )}
                    <div className="encounter-cast">
                      {e.cast.map((c) => {
                        const n = encounterNpc(e.moduleId, c.npcId)!;
                        return (
                          <div className="encounter-cast-row" key={c.id}>
                            <div>
                              <span className={`encounter-role role-${c.role}`}>
                                {roles[c.role]}
                              </span>{" "}
                              <button
                                className="text-button"
                                onClick={() =>
                                  setInspect({ e, npcId: c.npcId })
                                }
                              >
                                {c.name}{" "}
                                {c.count !== null
                                  ? `×${c.count}`
                                  : "· 数量待定"}
                              </button>
                              {c.optional && <small> · 按剧情选择</small>}
                              <p>{c.note}</p>
                            </div>
                            <span className="encounter-panel-status">
                              {n.missing?.length
                                ? "面板待补 / 核对"
                                : "查看面板与招式"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <ul className="encounter-notes">
                      {e.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                    <div className="encounter-card-footer">
                      <EncounterSources encounter={e} />
                      <button
                        className="button primary"
                        disabled={disabled}
                        onClick={async () => {
                          if (!imported.has(e.id)) {
                            await send({ kind: "scriptImport", ids: [e.id] });
                            return;
                          }
                          setPrepare(e);
                        }}
                      >
                        {imported.has(e.id) ? "核对阵容并载入" : "导入此遭遇"}
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </section>
          );
        })}
      {!visible.length && (
        <p className="host-empty">没有匹配的遭遇，试试人物名称或切换模组。</p>
      )}
      {["running", "paused"].includes(h.board.status) && (
        <p className="host-hint">
          当前遭遇尚未结束，可以继续备团；结束当前场次后才能载入另一场。
        </p>
      )}
      {prepare && (
        <PrepareEncounter
          key={prepare.id}
          encounter={prepare}
          close={() => setPrepare(null)}
          loaded={() => {
            setPrepare(null);
            a.setView("先攻");
            onLoaded?.();
          }}
        />
      )}
      {inspect && (
        <ActorReference
          e={inspect.e}
          npcId={inspect.npcId}
          close={() => setInspect(null)}
        />
      )}
    </section>
  );
}
function PrepareEncounter({
  encounter: e,
  close,
  loaded,
}: {
  encounter: AdventureEncounter;
  close: () => void;
  loaded: () => void;
}) {
  const { a, h, send, disabled } = useHost(),
    d = useHostDraft(
      `xia-encounter:${a.campaign?.name}:${e.id}`,
      {
        counts: initialEncounterCounts(e),
        characterIds: a
          .campaign!.characters.filter((c) => c.build.kind === "pc")
          .map((c) => c.id),
      },
      h.revision,
    ),
    issues = encounterIssues(e, d.value.counts),
    activeEncounter = ["running", "paused"].includes(h.board.status);
  const pcs = a.campaign!.characters.filter((c) => c.build.kind === "pc"),
    opening = e.cast
      .filter((c) => c.role === "opening")
      .reduce((n, c) => n + (d.value.counts[c.id] ?? 0), 0),
    reserves = e.cast
      .filter((c) => c.role === "reserve")
      .reduce((n, c) => n + (d.value.counts[c.id] ?? 0), 0);
  const change = (id: string, count: number | null) =>
    d.setValue({ ...d.value, counts: { ...d.value.counts, [id]: count } });
  return (
    <HostModal
      title={`准备 · ${e.title}`}
      description="选择参战角色并核对人数。载入后可一键自动掷先攻，再由主持人开始。"
      close={close}
      wide
    >
      <div className="encounter-load-summary">
        {e.cast.some(
          (c) => c.role === "opening" && d.value.counts[c.id] === null,
        )
          ? "开场人数待定"
          : `开场 ${opening} 位 NPC`}{" "}
        · 候场 {reserves} 位 · 玩家 {d.value.characterIds.length} 位
      </div>
      <fieldset className="encounter-party">
        <legend>本场参战角色</legend>
        {pcs.map((ch) => (
          <label key={ch.id}>
            <input
              type="checkbox"
              checked={d.value.characterIds.includes(ch.id)}
              onChange={(ev) =>
                d.setValue({
                  ...d.value,
                  characterIds: ev.target.checked
                    ? [...d.value.characterIds, ch.id]
                    : d.value.characterIds.filter((id) => id !== ch.id),
                })
              }
            />
            {ch.build.name}
          </label>
        ))}
        {!pcs.length && <p>暂无玩家角色，载入后仍可加入团员。</p>}
      </fieldset>
      {e.cast
        .filter((c) => c.role !== "support")
        .map((c) => {
          const npc = encounterNpc(e.moduleId, c.npcId)!,
            value = d.value.counts[c.id];
          return (
            <div key={c.id} className="encounter-prepare-row">
              <div>
                <b>{c.name}</b>
                <small> · {roles[c.role]}</small>
                <p>{c.note}</p>
                {!!npc.missing?.length && (
                  <p className="encounter-missing">
                    待核对：{npc.missing.join("、")}
                  </p>
                )}
              </div>
              {c.optional ? (
                <label>
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(ev) =>
                      change(c.id, ev.target.checked ? (c.count ?? 1) : 0)
                    }
                  />
                  本场加入
                </label>
              ) : c.count === null ||
                (e.id === "chengyun-finale" && c.id === e.cast[0].id) ? (
                <label className="field">
                  {c.count === null ? "数量（待定）" : "开场人数"}
                  <input
                    aria-label={`${c.name}数量`}
                    type="number"
                    min={e.id === "biaoxing-quarters" ? 7 : 1}
                    max={c.maximum ?? c.count ?? 30}
                    value={value ?? ""}
                    onChange={(ev) =>
                      change(
                        c.id,
                        ev.target.value === "" ? null : Number(ev.target.value),
                      )
                    }
                  />
                </label>
              ) : (
                <strong>×{c.count}</strong>
              )}
            </div>
          );
        })}
      <details className="encounter-briefing" open>
        <summary>本场提醒与场外支援</summary>
        <ul>
          {e.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        {e.cast
          .filter((c) => c.role === "support")
          .map((c) => (
            <p key={c.id}>
              <b>{c.name}</b>
              {c.optional ? "（视剧情）" : ""}：
              {c.note || "按原文提供协助，不占先攻位。"}
            </p>
          ))}
      </details>
      <div className="encounter-load-actions">
      {activeEncounter ? (
        <div className="encounter-load-blocker" role="status">
          <p>当前「{h.board.title}」{h.board.status === "paused" ? "已暂停，尚未结束" : "正在进行"}。先结束当前遭遇，才能载入另一场；本次选择会保留。</p>
          <button className="button" onClick={loaded}>返回当前先攻</button>
        </div>
      ) : !!h.board.units.length && (
        <p className="host-hint">载入时自动归档当前「{h.board.title}」并换成本场阵容，角色卡资源保持现状。</p>
      )}
      {!!issues.length && (
        <p className="encounter-missing" role="status">
          {issues.join(" ")}
        </p>
      )}
      <DraftConflict conflict={d.conflict} rebase={d.rebase} />
      {!a.online && <p className="encounter-missing" role="status">当前离线，恢复连接后即可载入。本次选择已保留。</p>}
      <button
        className="button primary"
        disabled={
          disabled ||
          !d.ready ||
          d.conflict ||
          !!issues.length ||
          activeEncounter
        }
        onClick={async () => {
          if (
            await send(
              {
                kind: "scriptLoad",
                id: e.id,
                counts: d.value.counts,
                characterIds: d.value.characterIds,
              },
              d.base,
            )
          ) {
            d.clear();
            loaded();
          }
        }}
      >
        {a.busy ? "正在保存…" : !d.ready ? "正在恢复选择…" : "载入阵容，准备先攻"}
      </button>
      </div>
    </HostModal>
  );
}
export function EncounterBriefing({ id }: { id: string }) {
  const e = getAdventureEncounter(id),
    [npc, setNpc] = useState<string | null>(null);
  if (!e) return null;
  return (
    <section className="paper panel encounter-board-briefing">
      <p className="eyebrow">
        <BookOpen size={15} /> 本场剧本备忘
      </p>
      <details open>
        <summary>{e.title} · 条件与支援</summary>
        {e.trigger && <p>{e.trigger}</p>}
        <ul className="encounter-notes">
          {e.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        {e.cast
          .filter((c) => c.role === "support")
          .map((c) => (
            <p key={c.id}>
              <button className="text-button" onClick={() => setNpc(c.npcId)}>
                {c.name}
              </button>
              {c.optional ? "（视剧情）" : ""}：
              {c.note || "按原文协助，不占先攻位。"}
            </p>
          ))}
        <EncounterSources encounter={e} />
      </details>
      {npc && <ActorReference e={e} npcId={npc} close={() => setNpc(null)} />}
    </section>
  );
}
