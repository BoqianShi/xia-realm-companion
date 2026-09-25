"use client";
import {
  AdventureEncounterLibrary,
  EncounterBriefing,
} from "./adventure-encounters";
import {
  encounterNpc,
  getAdventureEncounter,
} from "@/lib/adventure-encounters";
import { ReferenceDrawer } from "./reference-drawer";
import { PortraitPicker } from "./portrait";
import { Portrait } from "./person-portrait";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Dices,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import {
  blankUnit,
  characterUnit,
  npcUnit,
  visibleUnit,
  nextUnit,
  initiativeBonus,
  type StageUnit,
} from "@/lib/hosting";
import { modules } from "@/lib/modules";
import { ModulePeople } from "./module-people";
import { PartyDetails } from "./party-details";
import {
  useHost,
  HostModal,
  DraftConflict,
  useHostDraft,
  useModuleContent,
  statusLabels,
  sideLabels,
} from "./host-shared";

function initiativeResult(u: StageUnit) {
  if (u.score === null) return u.bonus === null ? "先攻加值待补" : `待掷 D20 · 先攻加值 ${u.bonus >= 0 ? "+" : ""}${u.bonus}`;
  if (u.die === null || u.bonus === null) return `先攻 ${u.score} · 主持人指定总值`;
  return `D20 ${u.die} ${u.bonus >= 0 ? "＋" : "−"} ${Math.abs(u.bonus)} ＝ ${u.score}`;
}

export function InitiativeBoard() {
  const { a, h, send, disabled } = useHost(),
    b = h.board;
  const [adding, setAdding] = useState<"module" | "manual" | null>(null),
    [editing, setEditing] = useState<StageUnit | null>(null),
    [inspecting, setInspecting] = useState<StageUnit | null>(null),
    [newTitle, setNewTitle] = useState<string | null>(null),
    [presetName, setPresetName] = useState<string | null>(null),
    [scripts, setScripts] = useState(false);
  if (!a.campaign) return <p role="status">正在读取行动顺序…</p>;
  const current = b.units.find((u) => u.id === b.activeId),
    next = nextUnit(b)?.unit,
    roundMode = b.trackingMode !== "turn";
  const name = (u: StageUnit | undefined) =>
    u
      ? a.dm || !u.hidden
        ? visibleUnit(a.campaign!, u).name
        : "主持人处理当前回合"
      : "等待开始";
  const mine = b.units.find(
      (u) =>
        u.characterId === a.selected && !u.out && !u.reserve && !u.offstage,
    ),
    missing = b.units.filter(
      (u) => !u.out && !u.reserve && !u.offstage && u.score === null,
    ),
    ready = missing.filter((u) => initiativeBonus(a.campaign!, u) !== null),
    missingBonus = missing.filter((u) => initiativeBonus(a.campaign!, u) === null),
    scores = b.units
      .filter((u) => !u.out && !u.reserve && !u.offstage && u.score !== null)
      .map((u) => u.score),
    ties = new Set(scores).size !== scores.length;
  return (
    <div className="initiative-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">自动先攻 · 共享行动顺序</p>
          <h1>先攻与回合</h1>
        </div>
        <div className="button-group">
          <a className="button" href="/screen" target="_blank" rel="noreferrer">
            <Monitor size={17} />
            打开大屏
          </a>
          {a.dm && (
            <button className="button" onClick={() => a.setView("主持台")}>
              返回主持台
            </button>
          )}
        </div>
      </div>
      <div className="host-turn-banner" aria-live="polite">
        <div>
          <span className="host-status">
            {statusLabels[b.status]} · {b.title}
          </span>
          <p>
            {b.status === "setup"
              ? missing.length || !scores.length ? "自动掷先攻，排好行动顺序" : "先攻已就绪，等待开始"
              : b.status === "ended"
                ? "本场遭遇已结束"
                : roundMode ? `第 ${b.round} 轮进行中` : name(current)}
          </p>
          <span>
            {roundMode && ["running", "paused"].includes(b.status) ? "这一轮在线下处理完，再点下一轮" : next && b.status !== "setup" && b.status !== "ended"
              ? `随后 · ${name(next)}`
              : "由主持人控制开始与推进"}
          </span>
        </div>
        <div className="host-round">
          <small>轮数</small>
          <strong>{b.round || "—"}</strong>
        </div>
      </div>
      {a.dm ? (
        <>
        <div className="initiative-mode" role="group" aria-label="行动记录方式">
          <button className="button" aria-pressed={roundMode} disabled={disabled} onClick={() => void send({ kind: "trackingMode", mode: "round" })}>整轮记录</button>
          <button className="button" aria-pressed={!roundMode} disabled={disabled} onClick={() => void send({ kind: "trackingMode", mode: "turn" })}>逐位记录</button>
          <small>只改行动标记，不扣资源或递减状态。</small>
        </div>
        <div className="host-actions">
          <div className="button-group">
            {b.status === "setup" && (
              <>
                <button
                  className={missing.length ? "button primary" : "button"}
                  disabled={disabled || !ready.length}
                  onClick={() => void send({ kind: "rollAll", reroll: false })}
                >
                  <Dices size={17} />
                  {missing.length && scores.length ? "补掷先攻并排序" : "自动掷先攻并排序"}
                </button>
                <button
                  className={missing.length ? "button" : "button primary"}
                  disabled={
                    disabled ||
                    !b.units.some((u) => !u.out && !u.reserve && !u.offstage) ||
                    !!missing.length
                  }
                  onClick={() => void send({ kind: "start" })}
                >
                  <Play size={16} />
                  开始遭遇
                </button>
                {!!scores.length && <details className="initiative-adjust">
                  <summary>调整先攻</summary>
                  <div className="button-group">
                    <button className="button" disabled={disabled} onClick={() => void send({ kind: "sort" })}>仅重新排序</button>
                    <button className="button" disabled={disabled || !b.units.some((u) => !u.out && !u.reserve && !u.offstage && initiativeBonus(a.campaign!, u) !== null)} onClick={() => void send({ kind: "rollAll", reroll: true })}>重掷在场人物并排序</button>
                  </div>
                </details>}
              </>
            )}
            {b.status === "running" && (
              <>
                <button
                  className="button primary"
                  disabled={disabled}
                  onClick={() => void send({ kind: "nextRound" })}
                >
                  下一轮 · 第 {b.round + 1} 轮
                  <ChevronRight size={17} />
                </button>
                {!roundMode && <button
                  className="button"
                  disabled={disabled}
                  onClick={() => void send({ kind: "next" })}
                >
                  下一位
                  <ChevronRight size={17} />
                </button>}
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() => void send({ kind: "pause" })}
                >
                  <Pause size={16} />
                  暂停
                </button>
              </>
            )}
            {b.status === "paused" && (
              <button
                className="button primary"
                disabled={disabled}
                onClick={() => void send({ kind: "resume" })}
              >
                <Play size={16} />
                继续
              </button>
            )}
            {["running", "paused"].includes(b.status) && (
              <button
                className="button"
                disabled={disabled}
                onClick={() => void send({ kind: "end" })}
              >
                结束遭遇
              </button>
            )}
            <button
              className="button"
              disabled={disabled || !h.history.length}
              onClick={() => void send({ kind: "undo" })}
            >
              <RotateCcw size={15} />
              撤销先攻操作
            </button>
          </div>
          <div className="button-group">
            <button
              className="button"
              disabled={disabled}
              onClick={() => void send({ kind: "publish", mode: "initiative" })}
            >
              投屏战况
            </button>
            <button
              className="button"
              disabled={["running", "paused"].includes(b.status)}
              onClick={() => setNewTitle("新的遭遇")}
            >
              新遭遇
            </button>
          </div>
        </div>
        </>
      ) : (
        <p className="host-hint">
          先攻由网页自动掷骰；你可以为自己的角色掷先攻，也可以等主持人统一掷骰。回合由主持人推进。
        </p>
      )}
      {b.status === "setup" && (
        <p className="host-hint">
          {missing.length
            ? `待掷先攻：${missing.map((u) => (a.dm || !u.hidden ? u.name : "未公开单位")).join("、")}。`
            : b.units.some((u) => !u.out && !u.reserve && !u.offstage)
              ? "先攻已就绪，可以开始遭遇。"
              : "加入团员或怪物后，一键掷 D20、加上先攻加值并排序。"}
          {ties && " 有同分，请由主持人用上下箭头裁定顺序。"}{" "}
          推进只改变行动标记，资源和状态均由现场手动记录。
        </p>
      )}
      {a.dm && !!missingBonus.length && b.status === "setup" && <p className="host-hint">
        {missingBonus.map((u) => u.name).join("、")}缺少先攻加值，点人物旁的“补充先攻加值”后即可掷骰；其他人物可先自动掷骰。
      </p>}
      {!a.dm && mine && b.status === "setup" && (
        <div className="host-dice-row">
          <b>{a.character?.build.name}</b>
          <span>{mine.score === null ? `D20 ＋ ${initiativeBonus(a.campaign, mine) ?? "待补加值"}` : initiativeResult(mine)}</span>
          <button className="button primary" disabled={disabled || mine.score !== null}
            onClick={() => void send({ kind: "autoRoll", id: mine.id, characterId: mine.characterId })}>
            <Dices size={17} />{mine.score === null ? "掷我的先攻" : "先攻已记录"}
          </button>
        </div>
      )}
      {a.dm && (
        <div className="host-add-row">
          <button className="button primary" onClick={() => setScripts(true)}>
            从剧本准备遭遇
          </button>
          <button
            className="button"
            disabled={
              disabled ||
              !a.campaign.characters.some(
                (ch) =>
                  ch.build.kind === "pc" &&
                  !b.units.some((u) => u.characterId === ch.id),
              )
            }
            onClick={() =>
              void send({
                kind: "add",
                units: a
                  .campaign!.characters.filter(
                    (ch) =>
                      ch.build.kind === "pc" &&
                      !b.units.some((u) => u.characterId === ch.id),
                  )
                  .map(characterUnit),
              })
            }
          >
            <Users size={17} />
            加入团员
          </button>
          <button className="button" onClick={() => setAdding("module")}>
            <Plus size={17} />
            从模组加入 NPC／怪物
          </button>
          <button className="button" onClick={() => setAdding("manual")}>
            临时人物
          </button>
          <button
            className="text-button"
            disabled={!b.units.length}
            onClick={() => setPresetName(b.title)}
          >
            保存为遭遇预设
          </button>
        </div>
      )}
      {!b.units.length ? (
        <section className="paper host-empty">
          <h2>{a.dm ? "先把这一桌的人排进来" : "等待主持人建立遭遇"}</h2>
          <p>
            {a.dm
              ? "点击“从剧本准备遭遇”，按模组选择场次，敌人与援军已经排好。"
              : "这里会显示当前行动者、下一位和轮数。"}
          </p>
        </section>
      ) : (
        <ol className="stage-roster" aria-label="先攻顺序">
          {b.units
            .filter((u) => !u.reserve && !u.offstage && (a.dm || !u.hidden))
            .map((u, i) => {
              const v = visibleUnit(a.campaign!, u),
                active = !roundMode && u.id === b.activeId && b.status !== "ended";
              return (
                <li
                  key={u.id}
                  className={`stage-unit side-${u.side} ${active ? "is-current" : ""} ${u.out ? "is-out" : ""}`}
                  aria-current={active ? "step" : undefined}
                >
                  <button
                    className="stage-score"
                    aria-label={`${v.name} · 先攻 ${u.score ?? "待掷"}`}
                    disabled={!a.dm}
                    onClick={() => setEditing(u)}
                  >
                    <strong>{u.score ?? "—"}</strong>
                    <small>先攻</small>
                  </button>
                  <button
                    className="stage-identity"
                    onClick={() => setInspecting(u)}
                  >
                    <span>
                      {sideLabels[u.side]}
                      {u.hidden ? " · 投屏隐藏" : ""}
                      {u.out ? " · 已退场" : ""}
                      {active ? " · 当前行动" : ""}
                    </span>
                    <span className="stage-person-title">
                      {v.portraitId && <Portrait name={v.name} src={a.campaign?.portraits?.[v.portraitId]} />}
                      <b>{v.name}</b>
                    </span>
                    <small>{initiativeResult(u)}</small>
                    <small>
                      {v.healthLabel} {v.hp ?? "未提供"}
                      {v.hpMax !== null ? ` / ${v.hpMax}` : ""}
                      {v.mp !== null
                        ? ` · 内力 ${v.mp}${v.mpMax !== null ? ` / ${v.mpMax}` : ""}`
                        : ""}
                    </small>
                    {v.conditions && <em>{v.conditions}</em>}
                  </button>
                  <div className="stage-row-actions">
                    <button className="button" onClick={() => setInspecting(u)}>
                      状态与招式
                    </button>
                    {a.dm && (
                      <>
                        {["running", "paused"].includes(b.status) && !u.out && (!active || roundMode) && <button className="button" disabled={disabled} title="标记为当前行动者，轮数不变" onClick={() => void send({ kind: "setActive", id: u.id })}>轮到此人</button>}
                        {u.score === null && !u.out && b.status !== "ended" && <button
                          className="button" disabled={disabled}
                          onClick={() => initiativeBonus(a.campaign!, u) === null ? setEditing(u) : void send({ kind: "autoRoll", id: u.id })}>
                          {initiativeBonus(a.campaign!, u) === null ? "补充先攻加值" : "自动掷先攻"}
                        </button>}
                        <button
                          className="button"
                          onClick={() => setEditing(u)}
                        >
                          编辑
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${v.name} 上移`}
                          disabled={disabled || i === 0}
                          onClick={() =>
                            void send({
                              kind: "move",
                              id: u.id,
                              direction: "up",
                            })
                          }
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${v.name} 下移`}
                          disabled={disabled || i === b.units.length - 1}
                          onClick={() =>
                            void send({
                              kind: "move",
                              id: u.id,
                              direction: "down",
                            })
                          }
                        >
                          <ArrowDown size={17} />
                        </button>
                        <button
                          className="text-button"
                          disabled={disabled}
                          onClick={() =>
                            void send({ kind: "out", id: u.id, out: !u.out })
                          }
                        >
                          {u.out ? "恢复出场" : "退场"}
                        </button>
                        {!roundMode && b.activeId && b.activeId!==u.id && <button className="text-button" title="脱离濒死后，先攻移至当前行动者之后；资源仍手动记录" disabled={disabled} onClick={()=>send({kind:"recoverOrder",id:u.id})}>获救 · 排到当前之后</button>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
        </ol>
      )}
      {a.dm && b.units.some((u) => u.reserve) && (
        <section className="paper panel encounter-reserves">
          <h2>候场援军 · {b.units.filter((u) => u.reserve).length} 位</h2>
          <p className="muted">
            不参与开场掷骰或投屏。按剧情点击入场时自动掷先攻；进行中的队列由主持人用上下箭头安排插入位置。
          </p>
          {b.units
            .filter((u) => u.reserve)
            .map((u) => (
              <div className="encounter-reserve-row" key={u.id}>
                <div>
                  <b>{u.name}</b>
                  <p>{u.note}</p>
                  <small>
                    {u.healthLabel} {u.hp ?? "未提供"} · 先攻{" "}
                    {u.score ?? "入场时自动掷骰"}
                  </small>
                </div>
                <div className="button-group">
                  <button className="button" onClick={() => setInspecting(u)}>
                    面板
                  </button>
                  <button className="button" onClick={() => setEditing(u)}>
                    编辑加值 / 资源
                  </button>
                  <button
                    className="button primary"
                    disabled={
                      disabled || (u.score === null && initiativeBonus(a.campaign!, u) === null) || b.status === "ended"
                    }
                    onClick={() => void send({ kind: "enter", id: u.id })}
                  >
                    {u.score === null ? "自动掷骰并入场" : "入场"}
                  </button>
                  {u.score === null && initiativeBonus(a.campaign!, u) === null && <small>先补充先攻加值</small>}
                </div>
              </div>
            ))}
        </section>
      )}
      {a.dm && b.scriptId === "biaoxing-ambush" && (
        <div className="host-add-row">
          {getAdventureEncounter(b.scriptId)!
            .cast.filter((c) => c.role === "reserve")
            .map((c) => (
              <button
                className="button"
                key={c.id}
                disabled={disabled || b.status === "ended"}
                onClick={() => void send({ kind: "scriptWave", actorId: c.id })}
              >
                再备一波：{c.name} ×{c.count}
              </button>
            ))}
        </div>
      )}
      {a.dm && b.units.some((u) => u.offstage) && (
        <section className="paper panel">
          <h2>独立状态记录</h2>
          <p className="muted">
            这些目标不额外占用先攻回合，按剧本记录体力或效果。
          </p>
          {b.units
            .filter((u) => u.offstage)
            .map((u) => (
              <div className="encounter-reserve-row" key={u.id}>
                <div>
                  <b>{u.name}</b>
                  <p>{u.note}</p>
                  <span>
                    {u.healthLabel} {u.hp ?? "未提供"} / {u.hpMax ?? "—"}
                  </span>
                </div>
                <button className="button" onClick={() => setEditing(u)}>
                  记录资源
                </button>
              </div>
            ))}
        </section>
      )}
      {a.dm && b.scriptId && <EncounterBriefing id={b.scriptId} />}
      {scripts && (
        <ReferenceDrawer
          title="剧本遭遇"
          description="按模组与场次准备整场阵容。"
          close={() => setScripts(false)}
        >
          <AdventureEncounterLibrary onLoaded={() => setScripts(false)} />
        </ReferenceDrawer>
      )}
      {a.dm && h.history.length > 0 && (
        <details className="host-history">
          <summary>最近先攻记录 · {h.history.length} 条</summary>
          {h.history.map((e) => (
            <p key={e.id}>
              <time>{new Date(e.at).toLocaleTimeString("zh-CN")}</time>{" "}
              {e.label}
            </p>
          ))}
        </details>
      )}
      {adding === "module" && (
        <ModuleUnitPicker close={() => setAdding(null)} />
      )}
      {(adding === "manual" || editing) && (
        <UnitEditor
          key={editing?.id ?? "new"}
          unit={editing ?? blankUnit()}
          isNew={!editing}
          close={() => {
            setAdding(null);
            setEditing(null);
          }}
        />
      )}
      {inspecting && (
        <UnitInspector
          unit={inspecting}
          close={() => setInspecting(null)}
          edit={() => {
            setEditing(
              b.units.find((u) => u.id === inspecting.id) ?? inspecting,
            );
            setInspecting(null);
          }}
        />
      )}
      {newTitle !== null && (
        <HostModal
          title="新建遭遇"
          description="已结束的阵容会归档，角色卡资源保持现状。"
          close={() => setNewTitle(null)}
        >
          <label className="field">
            遭遇名称
            <input
              value={newTitle}
              maxLength={80}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={disabled || !newTitle.trim()}
            onClick={async () => {
              if (await send({ kind: "new", title: newTitle }))
                setNewTitle(null);
            }}
          >
            建立
          </button>
        </HostModal>
      )}
      {presetName !== null && (
        <HostModal
          title="保存遭遇预设"
          description="保存阵容与模组来源。载入后重新自动掷先攻；独立 NPC 的资源取其上限，角色卡保持现状。"
          close={() => setPresetName(null)}
        >
          <label className="field">
            预设名称
            <input
              value={presetName}
              maxLength={80}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={disabled || !presetName.trim()}
            onClick={async () => {
              if (await send({ kind: "presetSave", name: presetName }))
                setPresetName(null);
            }}
          >
            保存阵容
          </button>
        </HostModal>
      )}
    </div>
  );
}
export function ModuleUnitPicker({ close }: { close: () => void }) {
  const { a, h, send, disabled } = useHost(),
    [moduleId, setModule] = useState(
      a.campaign?.modules?.[0]?.id ?? modules[0].id,
    ),
    [query, setQuery] = useState(""),
    [qty, setQty] = useState(1),
    [feedback, setFeedback] = useState("");
  const { data, error } = useModuleContent(moduleId);
  return (
    <HostModal
      wide
      title="从模组加入 NPC／怪物"
      close={close}
      description="每次加入都会建立独立现场记录，不修改原书人物模板。缺失的面板会保留为空。"
    >
      <div className="host-picker-controls">
        <label className="field">
          模组
          <select
            value={moduleId}
            onChange={(e) => {
              setModule(e.target.value);
              setFeedback("");
            }}
          >
            {modules.map((m) => (
              <option value={m.id} key={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          搜索人物
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="姓名、怪物或阵营"
          />
        </label>
        <label className="field">
          加入数量
          <input
            type="number"
            min={1}
            max={12}
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
            }
          />
        </label>
      </div>
      {feedback && (
        <p role="status" className="success">
          {feedback}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">正在读取模组…</p>}
      <div className="host-catalog-list">
        {data?.npcs
          .filter((p) =>
            `${p.name} ${p.group} ${p.description}`.includes(query),
          )
          .map((p) => {
            const initial = npcUnit(moduleId, p);
            return (
              <article key={p.id}>
                <div>
                  <b>{p.name}</b>
                  <small>
                    {p.group} · {initial.healthLabel} {initial.hp ?? "未提供"} ·
                    先攻加值 {initial.bonus ?? "未提供"} · {p.moves.length} 招
                  </small>
                  {!!p.missing?.length && (
                    <small className="warning">
                      资料有缺项，可加入后现场补记。
                    </small>
                  )}
                </div>
                <button
                  className="button"
                  disabled={disabled || h.board.units.length + qty > 60}
                  onClick={async () => {
                    const existing = h.board.units.filter(
                      (u) => u.moduleId === moduleId && u.npcId === p.id,
                    ).length;
                    const units = Array.from({ length: qty }, (_, i) => ({
                      ...npcUnit(moduleId, p),
                      name:
                        qty > 1 || existing
                          ? `${p.name} ${existing + i + 1}`
                          : p.name,
                    }));
                    if (await send({ kind: "add", units }))
                      setFeedback(`已加入 ${qty} 位「${p.name}」`);
                  }}
                >
                  加入{qty > 1 ? ` ×${qty}` : ""}
                </button>
              </article>
            );
          })}
      </div>
      <button className="button primary" onClick={close}>
        完成，查看阵容
      </button>
    </HostModal>
  );
}
function UnitEditor({
  unit,
  isNew,
  close,
}: {
  unit: StageUnit;
  isNew: boolean;
  close: () => void;
}) {
  const { a, h, send, disabled } = useHost(),
    d = useHostDraft<StageUnit & { portraitData?: string }>(
      `xia-unit-draft-${isNew ? "new" : unit.id}`,
      unit,
      h.revision,
    ),
    v = d.value,
    patch = (p: Partial<StageUnit & { portraitData?: string }>) => d.setValue({ ...v, ...p });
  const [processingPortrait, setProcessingPortrait] = useState(false);
  const save = async () => {
    const { portraitData, ...savedUnit } = v;
    const portraits = portraitData && savedUnit.portraitId ? { [savedUnit.portraitId]: portraitData } : undefined;
    if (
      await send(
        isNew ? { kind: "add", units: [savedUnit], portraits } : { kind: "edit", unit: savedUnit, portraits },
        d.base,
      )
    ) {
      d.clear();
      close();
    }
  };
  return (
    <HostModal
      title={isNew ? "添加临时人物" : `现场记录 · ${unit.name}`}
      close={close}
      description="先攻在队列中自动掷骰。这里可补充加值，或按现场裁定手动修正结果；资源仍手动记录。"
    >
      {!v.characterId && <PortraitPicker name={v.publicName || v.name} value={v.portraitData ?? a.campaign?.portraits?.[v.portraitId ?? ""]} disabled={disabled || !d.ready} onBusyChange={setProcessingPortrait} onChange={(data) => patch({ portraitId: data ? crypto.randomUUID() : "", portraitData: data || undefined })} />}
      <div className="host-fields">
        <label className="field">
          名称
          <input
            value={v.name}
            disabled={!!v.characterId}
            maxLength={80}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <label className="field">
          阵营
          <select
            value={v.side}
            onChange={(e) =>
              patch({ side: e.target.value as StageUnit["side"] })
            }
          >
            {Object.entries(sideLabels).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          先攻加值
          <input
            type="number"
            value={v.bonus ?? ""}
            onChange={(e) =>
              patch({
                bonus: e.target.value === "" ? null : Number(e.target.value),
                score:
                  v.die !== null
                    ? e.target.value === ""
                      ? null
                      : v.die + Number(e.target.value)
                    : v.score,
              })
            }
          />
        </label>
        <label className="field">
          D20 骰点（手动修正）
          <input
            type="number"
            min={1}
            max={20}
            value={v.die ?? ""}
            onChange={(e) => {
              const die = e.target.value === "" ? null : Number(e.target.value);
              patch({
                die,
                score: die !== null && v.bonus !== null ? die + v.bonus : null,
              });
            }}
          />
        </label>
        <label className="field">
          先攻总值
          <input
            type="number"
            value={v.score ?? ""}
            onChange={(e) =>
              patch({
                score: e.target.value === "" ? null : Number(e.target.value),
                die: null,
              })
            }
          />
          <small>
            {v.die !== null && v.bonus !== null
              ? `${v.die} ＋ ${v.bonus} ＝ ${v.score}`
              : "可按现场裁定直接填总值；留空为待填。"}
          </small>
        </label>
        <label className="field">
          投屏名称
          <input
            value={v.publicName}
            placeholder="留空使用原名"
            onChange={(e) => patch({ publicName: e.target.value })}
          />
        </label>
      </div>
      <label className="host-check">
        <input
          type="checkbox"
          checked={v.hidden}
          onChange={(e) => patch({ hidden: e.target.checked })}
        />
        在玩家先攻与投屏中隐藏
      </label>
      <label className="host-check">
        <input
          type="checkbox"
          checked={v.screenDetails ?? (v.side === "player")}
          onChange={(e) => patch({ screenDetails: e.target.checked })}
        />
        大屏显示气血、内力、挂招与状态
      </label>
      {v.characterId ? (
        <p className="host-hint">
          资源、状态与招式实时读取角色卡。在“状态与招式”中记录。
        </p>
      ) : (
        <>
          <div className="host-fields">
            {(
              [
                ["hp", v.healthLabel],
                ["hpMax", `${v.healthLabel}上限`],
                ["mp", "内力"],
                ["mpMax", "内力上限"],
                ["rage", "怒气"],
                ["shield", "护体"],
              ] as const
            ).map(([k, label]) => (
              <label className="field" key={k}>
                {label}
                <input
                  type="number"
                  min={0}
                  max={k === "rage" ? 10 : undefined}
                  value={v[k] ?? ""}
                  placeholder="原资料未提供"
                  onChange={(e) =>
                    patch({
                      [k]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="field">
            当前架招／挂招
            <input
              value={v.activeTechnique ?? ""}
              maxLength={120}
              onChange={(e) => patch({ activeTechnique: e.target.value })}
              placeholder="记录当前正在生效的招式"
            />
          </label>
          <label className="field">
            挂招效果（随战况公开）
            <textarea rows={2} maxLength={1000} value={v.activeTechniqueEffect ?? ""}
              onChange={(e) => patch({ activeTechniqueEffect: e.target.value })}
              placeholder="写清本次格挡、减伤或增益；留空时尝试显示同名规则原文" />
          </label>
          <label className="field">
            状态／增益／层数／持续
            <textarea
              rows={2}
              maxLength={1000}
              value={v.conditions}
              onChange={(e) => patch({ conditions: e.target.value })}
              placeholder="例如：流血 ×2；增益至张三第3个回合开始（手动修改）"
            />
          </label>
        </>
      )}
      <label className="field">
        现场备注
        <textarea
          rows={3}
          maxLength={4000}
          value={v.note}
          onChange={(e) => patch({ note: e.target.value })}
        />
      </label>
      <DraftConflict conflict={d.conflict} rebase={d.rebase} />
      <div className="button-group">
        <button
          className="button primary"
          disabled={disabled || !d.ready || d.conflict || !v.name.trim() || processingPortrait}
          onClick={() => void save()}
        >
          保存记录
        </button>
        {!isNew && (
          <button
            className="text-button"
            disabled={disabled || d.conflict}
            onClick={async () => {
              if (await send({ kind: "remove", id: v.id }, d.base)) {
                d.clear();
                close();
              }
            }}
          >
            移出本次阵容
          </button>
        )}
      </div>
    </HostModal>
  );
}
function UnitInspector({
  unit,
  close,
  edit,
}: {
  unit: StageUnit;
  close: () => void;
  edit: () => void;
}) {
  const { a, h } = useHost(),
    live = h.board.units.find((u) => u.id === unit.id) ?? unit,
    { data, error } = useModuleContent(live.moduleId),
    npc =
      data?.npcs.find((p) => p.id === live.npcId) ??
      encounterNpc(live.moduleId, live.npcId),
    ch = a.campaign?.characters.find((c) => c.id === live.characterId);
  if (ch) return <PartyDetails character={ch} onClose={close} />;
  return (
    <ReferenceDrawer
      title={live.name}
      close={close}
      description="上方是本次遭遇的状态；下方保留模组原始面板与招式。"
    >
      <div className="host-unit-resources">
        <span>
          {live.healthLabel}
          <b>
            {live.hp ?? "未提供"} / {live.hpMax ?? "—"}
          </b>
        </span>
        <span>
          内力
          <b>
            {live.mp ?? "未提供"} / {live.mpMax ?? "—"}
          </b>
        </span>
        <span>
          先攻<b>{live.score ?? "待填"}</b>
        </span>
      </div>
      {live.conditions && <p className="host-state-tags">{live.conditions}</p>}
      {live.note && <p className="preserve">{live.note}</p>}
      {a.dm && (
        <button className="button" onClick={edit}>
          记录资源与状态
        </button>
      )}
      {error && <p>{error}</p>}
      {live.moduleId && !data && !error && <p>正在打开原始招式…</p>}
      {data && npc && (
        <ModulePeople module={{ ...data, npcs: [npc] }} query="" compact />
      )}
      {!live.moduleId && (
        <p className="host-hint">临时人物没有关联武学资料，可在备注中补充。</p>
      )}
    </ReferenceDrawer>
  );
}
