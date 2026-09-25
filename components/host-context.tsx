"use client";
import { useState } from "react";
import { useHost, useHostDraft, DraftConflict } from "./host-shared";
import { EntityCard, LinkedNotes, ContextSearch } from "./context-cards";
import { resolveEntity, entityKey } from "@/lib/context-index";
import { adventureEncounters } from "@/lib/adventure-encounters";
import type { EntityRef } from "@/lib/hosting-schema";
import { RulesHelp } from "./rules-help";
export function ToneTrack() {
  const { h, send, disabled } = useHost();
  return (
    <details className="paper panel tone-track">
      <summary>
        <b>演奏辅助 · 五声音阶</b>
        <small>{h.tones?.join(" → ") || "乐谱招式的全场共享记录"}</small>
      </summary>
      <p className="tone-intro">宫、商、角、徵、羽是五种音阶。乐谱招式会用全场已记录的音阶判断“天籁之音”加成。</p>
      <p>先查看已有音阶并判断本曲的条件；成功演奏并施展后，手动加入所选音阶。只保留最近五音，不自动结算曲子效果。</p>
      <div className="button-group">
        {(["宫", "商", "角", "徵", "羽", "撤销", "清空"] as const).map(
          (value) => (
            <button
              className="button"
              key={value}
              disabled={disabled}
              onClick={() => send({ kind: "tone", value })}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <RulesHelp initialTopic="music" label="乐谱与音阶怎么用" className="text-button move-help" />
    </details>
  );
}
export function HostContext() {
  const { a, h, send, disabled } = useHost(),
    [target, setTarget] = useState<EntityRef | null>(null),
    [newSession, setNewSession] = useState(false),
    d = useHostDraft("xia-session-create", { title: "", date: "" }, h.revision);
  const current = h.scenes.find((s) => s.id === h.activeSceneId),
    encounters = adventureEncounters.filter(
      (e) =>
        e.moduleId === current?.moduleId &&
        (!current?.sourcePage || e.pages.includes(current.sourcePage)),
    );
  return (
    <div className="host-context">
      <section className="paper panel">
        <div className="section-heading">
          <h2>跑团场次</h2>
          <button className="button" onClick={() => setNewSession(!newSession)}>
            新增场次
          </button>
        </div>
        <label className="field">
          <span>查看场次</span>
          <select
            value={h.activeSessionId ?? "legacy-session"}
            onChange={(e) =>
              send({ kind: "sessionSelect", id: e.target.value })
            }
            disabled={disabled}
          >
            {(h.sessions ?? [{ ...h.session, id: "legacy-session" }]).map(
              (s) => (
                <option value={s.id} key={s.id}>
                  {s.title} {s.date}
                </option>
              ),
            )}
          </select>
        </label>
        {newSession && (
          <>
            <input
              aria-label="新场次名称"
              placeholder="如：雨亭试手 · 第2次"
              value={d.value.title}
              onChange={(e) =>
                d.setValue({ ...d.value, title: e.target.value })
              }
            />
            <input
              aria-label="场次日期"
              type="date"
              value={d.value.date}
              onChange={(e) => d.setValue({ ...d.value, date: e.target.value })}
            />
            <DraftConflict conflict={d.conflict} rebase={d.rebase} />
            <button
              className="button"
              disabled={disabled || d.conflict || !d.value.title.trim()}
              onClick={async () => {
                if (await send({ kind: "sessionNew", ...d.value }, d.base)) {
                  d.clear();
                  d.reset({ title: "", date: "" }, h.revision + 1);
                  setNewSession(false);
                }
              }}
            >
              保存当前场次并新建
            </button>
          </>
        )}
        {!!h.contextHistory?.length && (
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => send({ kind: "contextUndo" })}
          >
            撤销：{h.contextHistory[0].label}
          </button>
        )}
        <p className="muted">
          提纲、笔记与回顾按场次保留。切换场次不切换或重置正在进行的遭遇。
        </p>
      </section>
      <section className="paper panel">
        <h2>{current ? "当前场景 · " + current.title : "场景关联"}</h2>
        {current ? (
          <>
            <p>{current.text}</p>
            {current.moduleId && (
              <a
                className="button"
                href={`/adventures/${current.moduleId}?page=${current.sourcePage ?? 1}`}
                target="_blank"
                rel="noreferrer"
              >
                打开关联正文
              </a>
            )}
            {encounters.map((e) => (
              <div key={e.id}>
                <button
                  className="text-button"
                  onClick={() =>
                    setTarget({
                      kind: "encounter",
                      id: e.id,
                      moduleId: e.moduleId,
                    })
                  }
                >
                  {e.title}
                </button>
                <p>{e.trigger}</p>
                <div className="button-group">
                  {e.cast.map((n) => (
                    <button
                      key={n.id}
                      className="button"
                      onClick={() =>
                        setTarget({
                          kind: "npc",
                          id: n.npcId,
                          moduleId: e.moduleId,
                        })
                      }
                    >
                      {n.name} ·{" "}
                      {n.role === "reserve"
                        ? "后备"
                        : n.role === "support"
                          ? "关联人物"
                          : "开场"}
                      {n.count === null ? " · 人数待定" : " ×" + n.count}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <p>
            在“场景与线索”选择当前场景，并关联模组页码，即可集中查看对应人物和遭遇。
          </p>
        )}
      </section>
      {!!h.pins?.length && (
        <section className="paper panel">
          <h2>固定资料</h2>
          <div className="button-group">
            {h.pins.map((r) => (
              <button
                className="button"
                key={entityKey(r)}
                onClick={() => setTarget(r)}
              >
                {resolveEntity(r, a.campaign)?.name ?? "原引用待核对"}
              </button>
            ))}
          </div>
        </section>
      )}
      <ToneTrack />
      <ContextSearch />
      <section className="paper panel">
        <LinkedNotes
          refs={
            current
              ? [{ kind: "scene", id: current.id, moduleId: current.moduleId }]
              : []
          }
        />
      </section>
      <EntityCard target={target} close={() => setTarget(null)} />
    </div>
  );
}
