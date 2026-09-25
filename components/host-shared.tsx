"use client";
import { useEffect, useEffectEvent, useState, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { useApp } from "./app-context";
import { emptyHosting, type HostOperation } from "@/lib/hosting";
import { modules } from "@/lib/modules";
import type { ModuleContent } from "@/lib/module-types";
export function useHost() {
  const a = useApp(),
    h = a.campaign?.hosting ?? emptyHosting();
  return {
    a,
    h,
    send: (operation: HostOperation, revision = h.revision) =>
      a.mutate(["roll", "autoRoll"].includes(operation.kind) && !a.dm ? "hostRoll" : "host", {
        revision,
        operation,
      }),
    disabled: a.busy || !a.online,
  };
}
export function HostModal({
  title,
  description,
  children,
  close,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className={wide ? "wide-dialog host-modal" : "host-modal"}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description ?? "现场记录由全团共享；保存前可核对输入。"}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function useHostDraft<T>(key: string, initial: T, revision: number) {
  const [draft, setDraft] = useState({ key, value: initial, base: revision, dirty: false, ready: false });
  const current = draft.key === key;
  const value = current && draft.dirty ? draft.value : initial;
  const base = current && draft.dirty ? draft.base : revision;
  const ready = current && draft.ready;
  const loadDraft = useEffectEvent((draftKey: string) => {
    try {
      let raw = localStorage.getItem(draftKey);
      if (!raw && draftKey === "xia-host-session-draft:legacy-session") {
        raw = localStorage.getItem("xia-host-session-draft");
        if (raw) {
          localStorage.setItem(draftKey, raw);
          localStorage.removeItem("xia-host-session-draft");
        }
      }
      const d = JSON.parse(raw ?? "null");
      if (d && "value" in d && Number.isInteger(d.revision)) {
        setDraft({ key: draftKey, value: d.value, base: d.revision, dirty: true, ready: true });
        return;
      }
    } catch {}
    setDraft({ key: draftKey, value: initial, base: revision, dirty: false, ready: true });
  });
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      loadDraft(key);
    });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    // A key change must never persist the previous entity's draft under the new key.
    if (current && ready && draft.dirty)
      try {
        localStorage.setItem(key, JSON.stringify({ value, revision: base }));
      } catch {}
  }, [key, value, base, ready, current, draft.dirty]);
  return {
    value,
    setValue: (next: SetStateAction<T>) => setDraft({ key, value: typeof next === "function" ? (next as (v:T)=>T)(value) : next, base, dirty: true, ready: true }),
    base,
    ready,
    conflict: base !== revision,
    rebase: () => setDraft({ key, value, base: revision, dirty: true, ready: true }),
    reset: (next: T, nextRevision = revision, editing = false) => {
      try { localStorage.removeItem(key); } catch {}
      setDraft({ key, value: next, base: nextRevision, dirty: editing, ready: true });
    },
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}
export function DraftConflict({
  conflict,
  rebase,
}: {
  conflict: boolean;
  rebase: () => void;
}) {
  return conflict ? (
    <div className="host-conflict" role="alert">
      <p>共享主持台有更新，你的输入仍保留在本机。请核对最新资料后继续。</p>
      <button className="button" onClick={rebase}>
        已核对，保留输入继续保存
      </button>
    </div>
  ) : null;
}
export function useModuleContent(id: string) {
  const [result, setResult] = useState<{
    id: string;
    data: ModuleContent | null;
    error: string;
  }>({ id: "", data: null, error: "" });
  useEffect(() => {
    const m = modules.find((m) => m.id === id);
    if (!m) return;
    const abort = new AbortController();
    fetch(`${m.contentUrl}?v=${m.contentRevision ?? m.version}`, {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = (await r.json()) as ModuleContent;
        if (data.id !== id) throw Error();
        if (!abort.signal.aborted) setResult({ id, data, error: "" });
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setResult({
            id,
            data: null,
            error: "暂时无法读取模组，请重新选择或联网后重试。",
          });
      });
    return () => abort.abort();
  }, [id]);
  return result.id === id ? result : { data: null, error: "" };
}

export const statusLabels = {
  setup: "准备先攻",
  running: "进行中",
  paused: "已暂停",
  ended: "已结束",
};
export const sideLabels = { player: "侠士", ally: "盟友", enemy: "敌人" };
