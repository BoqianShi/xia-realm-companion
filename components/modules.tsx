"use client";
import { useEffect, useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { modules } from "@/lib/modules";
import type { ModuleNotebook } from "@/lib/module-types";
import { useApp } from "./app-context";

export function ModuleShelf() {
  const a = useApp();
  const notebooks = a.campaign?.modules ?? [];
  const missing = modules.filter((m) => !notebooks.some((n) => n.id === m.id));
  useEffect(() => {
    if (!a.dm || location.hash !== "#module-shelf") return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("module-shelf")?.scrollIntoView(),
    );
    return () => cancelAnimationFrame(frame);
  }, [a.dm]);
  if (!a.dm) return null;
  const importSet = async (ids: string[], open?: string) => {
    if (await a.mutate("importModules", { ids })) {
      a.setNotice(`已导入 ${ids.length} 本模组，原有角色和备团笔记保留。`);
      if (open) window.location.assign(`/adventures/${open}`);
    }
  };
  return (
    <section id="module-shelf" className="module-shelf paper panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DM 备团资料</p>
          <h2>模组书架</h2>
        </div>
        <button
          className="button primary"
          disabled={!missing.length || a.busy || !a.online}
          onClick={() => void importSet(missing.map((m) => m.id))}
        >
          <Download size={17} />
          {missing.length ? `一键导入全部 ${missing.length} 本` : "全部已导入"}
        </button>
      </div>
      <p className="muted">
        正文与人物数据直接阅读、搜索；地图和原始附件按需打开。导入后可保存章节进度、阅读书签和带团笔记。这里包含剧情答案，供主持人查阅。
      </p>
      <div className="module-books">
        {modules.map((m) => {
          const saved = notebooks.find((n) => n.id === m.id);
          return (
            <article className="module-book" key={m.id}>
              {m.cover ? <img src={m.cover} alt={`${m.title}封面`} loading="lazy" /> : <div className="demo-module-cover">{m.title}<small>{m.edition}</small></div>}
              <div>
                <div className="entry-meta">
                  <span>{m.difficulty}</span>
                  <span>{m.players}</span>
                </div>
                <h3>{m.title}</h3>
                <p>{m.intro}</p>
                <small>
                  {m.pageCount} 页 · {m.assetCount} 份附件
                  {m.npcCount
                    ? ` · ${m.npcCount} 条人物与怪物资料`
                    : m.npcPages.length
                      ? ` · ${m.npcPages.length} 页人物图版`
                      : ""}
                </small>
                <div className="button-group">
                  {saved ? (
                    <a className="button primary" href={`/adventures/${m.id}`}>
                      <BookOpen size={16} />
                      打开备团 · {saved.completed.length}/{m.sections.length}
                    </a>
                  ) : (
                    <button
                      className="button"
                      disabled={a.busy || !a.online}
                      onClick={() => void importSet([m.id], m.id)}
                    >
                      导入并打开
                    </button>
                  )}
                  <a className="text-button" href={`/adventures/${m.id}`}>
                    浏览资料
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ModuleNotes({
  notebook: n,
  title,
}: {
  notebook: ModuleNotebook;
  title: string;
}) {
  const a = useApp();
  const storageKey = "xia-module-notes-" + n.id;
  const [draft, setDraft] = useState(n.notes),
    [baseRevision, setBaseRevision] = useState(n.revision),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (saved) {
          setDraft(saved.text);
          setBaseRevision(saved.revision);
          setDirty(true);
        }
      } catch {}
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [storageKey]);
  useEffect(() => {
    if (ready && !dirty) {
      queueMicrotask(() => {
        setDraft(n.notes);
        setBaseRevision(n.revision);
      });
    }
  }, [n.notes, n.revision, dirty, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (dirty)
        localStorage.setItem(
          storageKey,
          JSON.stringify({ text: draft, revision: baseRevision }),
        );
      else localStorage.removeItem(storageKey);
    } catch {}
  }, [draft, baseRevision, dirty, ready, storageKey]);
  const conflict = dirty && baseRevision !== n.revision;
  return (
    <section className="module-notes">
      <h3>{title} · 带团笔记</h3>
      <p className="muted">
        记录现场改动、线索去向、人物态度和下次开场。输入自动保留在本机；点保存后同步到本团。
      </p>
      {conflict && (
        <div className="warning-box">
          <p>共享记录已更新，你的输入已保留。请先对照最新笔记，再决定保存。</p>
          <details>
            <summary>查看最新共享笔记</summary>
            <p className="rule-text">{n.notes || "当前没有共享笔记。"}</p>
          </details>
          <button
            className="button"
            onClick={() => {
              setBaseRevision(n.revision);
              setMessage("已核对最新版本，输入保留；点击保存即可提交。");
            }}
          >
            已核对，保留我的输入继续
          </button>
        </div>
      )}
      <label className="field">
        备团与现场记录
        <textarea
          maxLength={30000}
          disabled={a.busy}
          value={draft}
          rows={16}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
        />
      </label>
      <div className="button-group">
        <button
          className="button primary"
          disabled={
            !ready || !dirty || conflict || a.busy || !a.online || !a.dm
          }
          onClick={async () => {
            const ok = await a.mutate("saveModule", {
              id: n.id,
              revision: baseRevision,
              notes: draft,
            });
            if (ok) {
              setDirty(false);
              setMessage("笔记已保存到本团。");
            } else
              setMessage("未保存，你的输入仍在本机，请核对最新记录后重试。");
          }}
        >
          保存笔记
        </button>
        <small>
          {draft.length}/30000 · {dirty ? "有本机草稿" : "已同步"}
        </small>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
