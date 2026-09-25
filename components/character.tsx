"use client";
import { contentPack } from "@/lib/content-pack";
import { named, getEntry, sourceLabel } from "@/lib/catalog";
import { calculateCharacter } from "@/lib/rules";
import { ArrowUpRight, Plus, Users } from "lucide-react";
import { useApp } from "./app-context";
import { PlaySheet } from "./play-sheet";
export function CharacterView() {
  const a = useApp();
  const ch = a.character;
  if (a.loading && !a.campaign)
    return (
      <div className="paper panel" role="status">
        正在读取本团角色…已有草稿仍会保留。
      </div>
    );
  if (!ch)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">侠士名册</p>
            <h1>从这里，入江湖。</h1>
          </div>
          <button className="button primary" onClick={() => a.startDraft()}>
            <Plus size={18} />
            新建侠士
          </button>
        </div>
        {a.draft && (
          <div className="draft-banner">
            <span>有一份未应用的草稿：{a.draft.build.name || "新侠士"}</span>
            <button
              className="text-button"
              onClick={() => a.setBuilderOpen(true)}
            >
              继续试配 →
            </button>
          </div>
        )}
        {a.otherDrafts.length > 0 && (
          <details className="paper panel">
            <summary>其他已保留的草稿（{a.otherDrafts.length}）</summary>
            {a.otherDrafts.map((d) => (
              <button
                className="reference-row"
                key={d.id}
                onClick={() => {
                  a.setDraft(d);
                  a.setBuilderOpen(true);
                }}
              >
                <span>
                  {d.build.name || "未命名侠士"}
                  <small>仅保存在这台设备 · 继续上次步骤</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </details>
        )}
        {a.campaign?.characters.length ? (
          <div className="roster-grid">
            {a.campaign.characters.map((c) => {
              const stats = calculateCharacter(c.build);
              return (
                <button
                  className="paper roster-card"
                  onClick={() => {
                    a.select(c.id);
                    a.setDm(false);
                  }}
                  key={c.id}
                >
                  <span className="avatar">{c.build.name[0]}</span>
                  <div>
                    <small>
                      {c.build.kind === "npc"
                        ? "NPC"
                        : c.build.sect || "江湖侠士"}
                    </small>
                    <h2>{c.build.name}</h2>
                    <p>
                      气血上限 {stats.hpMax} · 内力上限 {stats.mpMax}
                    </p>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="welcome-grid">
            <section className="paper empty-character">
              <span className="large-glyph">侠</span>
              <h2>写下你的第一位侠士</h2>
              <p>
                选好身世、内功与武学，
                <br />
                属性和招式伤害随之算好。
              </p>
              <button className="button primary" onClick={() => a.startDraft()}>
                开始车卡 <ArrowUpRight size={17} />
              </button>
            </section>
            <section className="paper guide">
              <p className="eyebrow">车卡之前</p>
              <h2>从人级功法认识规则</h2>
              <p>
                先看内功怎样改变属性，再看一套武学包含哪些动作。高级功法以后也能在资料库找到。
              </p>
              {contentPack.starter.learn.map(l => getEntry(l.id)?.name ?? "").map((name) => {
                const e = named(name);
                return (
                  e && (
                    <button
                      key={name}
                      className="reference-row"
                      onClick={() => a.setDetail(e)}
                    >
                      <span>
                        <strong>{name}</strong>
                        <small>
                          {e.grade} · {e.affinity} · {sourceLabel(e)}
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  )
                );
              })}
              <button
                className="text-button"
                onClick={() => a.setView("资料库")}
              >
                翻阅完整资料库 →
              </button>
            </section>
          </div>
        )}
        <div className="note-strip">
          <Users size={19} />
          <span>选角色即可使用。设备会记住上次的选择；存档由全团共享。</span>
        </div>
      </>
    );
  return <PlaySheet key={ch.id} ch={ch} />;
}
