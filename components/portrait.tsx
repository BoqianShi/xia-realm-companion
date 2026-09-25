"use client";
import { useEffect, useId, useRef, useState } from "react";
import { preparePortrait } from "@/lib/portrait-upload";
import type { Character } from "@/lib/types";
import { useApp } from "./app-context";
import { DraftConflict, HostModal, useHostDraft } from "./host-shared";
import { Portrait } from "./person-portrait";

export function PortraitPicker({ value, name, disabled, onChange, onBusyChange }: {
  value?: string; name: string; disabled?: boolean; onChange: (data: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const inputId = useId(), ref = useRef<HTMLInputElement>(null), ticket = useRef(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => () => { ticket.current++; }, []);
  return <div className="portrait-picker">
    <Portrait src={value} name={name} />
    <div>
      <div className="button-group">
        <input className="sr-only" tabIndex={-1} id={inputId} ref={ref} type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择头像图片" disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            const current = ++ticket.current;
            setBusy(true); onBusyChange(true); setError("");
            try { const data = await preparePortrait(file); if (current === ticket.current) onChange(data); }
            catch (e) { if (current === ticket.current) setError(e instanceof Error ? e.message : "图片处理失败，请重试。"); }
            finally { if (current === ticket.current) { setBusy(false); onBusyChange(false); } }
          }} />
        <button type="button" className="button" disabled={disabled || busy} onClick={() => ref.current?.click()}>{busy ? "正在处理图片…" : value ? "更换头像" : "上传头像"}</button>
        {value && <button type="button" className="text-button" disabled={disabled || busy} onClick={() => { setError(""); onChange(""); }}>移除头像</button>}
      </div>
      <small>PNG、JPG、WebP，最大 10 MB。居中裁为方形，保存前可预览。</small>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  </div>;
}

export function CharacterPortraitEditor({ ch, close }: { ch: Character; close: () => void }) {
  const a = useApp();
  const d = useHostDraft<{ portraitId: string; portraits: Record<string, string> }>(`xia-portrait-draft:${ch.id}`, { portraitId: ch.portraitId ?? "", portraits: {} }, ch.revision);
  const [processing, setProcessing] = useState(false);
  const value = d.value;
  return <HostModal title={`头像 · ${ch.build.name}`} description="保存后，全团的人物卡、先攻列表和大屏会同步使用这张头像。" close={close}>
    <PortraitPicker name={ch.build.name} value={value.portraits[value.portraitId] ?? a.campaign?.portraits?.[value.portraitId]} disabled={!d.ready || a.busy} onBusyChange={setProcessing}
      onChange={(data) => { const id = data ? crypto.randomUUID() : ""; d.setValue({ portraitId: id, portraits: data ? { [id]: data } : {} }); }} />
    <DraftConflict conflict={d.conflict} rebase={d.rebase} />
    {!a.online && <p className="muted">头像草稿已保留在本机，恢复连接后再保存。</p>}
    <button className="button primary" disabled={!d.ready || a.busy || processing || !a.online || d.conflict} onClick={async () => {
      if (await a.mutate("savePortrait", { id: ch.id, revision: d.base, ...value })) { d.clear(); close(); }
    }}>保存头像</button>
  </HostModal>;
}
