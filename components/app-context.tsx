"use client";
import { addEntry, addPossession } from "@/lib/catalog";
import { changeDraftBackground, type BackgroundGrant } from "@/lib/onboarding";
import { emptyBuild } from "@/lib/rules";
import type { Build, Campaign, Character, Entry, Envelope } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
export type Draft = {
  id: string;
  revision: number;
  build: Build;
  isNew: boolean;
  step?: number;
  backgroundGrant?: BackgroundGrant;
};
export type AppState = {
  campaign: Campaign | null;
  version: number;
  selected: string;
  select: (id: string) => void;
  dm: boolean;
  setDm: (value: boolean) => void;
  view: string;
  setView: (value: string) => void;
  character: Character | undefined;
  online: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  setError: (s: string) => void;
  setNotice: (s: string) => void;
  mutate: (type: string, payload: unknown) => Promise<boolean>;
  refresh: () => Promise<void>;
  draft: Draft | null;
  otherDrafts: Draft[];
  duplicate: (ch: Character) => void;
  setDraft: (d: Draft | null) => void;
  builderOpen: boolean;
  setBuilderOpen: (b: boolean) => void;
  startDraft: (character?: Character, step?: number) => void;
  trial: (entry: Entry, level?: number) => void;
  detail: Entry | null;
  setDetail: (e: Entry | null) => void;
};
export const AppContext = createContext<AppState | null>(null);
export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error("Missing application context");
  return c;
};
export function useAppState(): AppState {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const envelopeRef = useRef<Envelope | null>(null);
  const [selected, setSelected] = useState("");
  const [dm, setDmState] = useState(false);
  const [view, setView] = useState("角色");
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraftState] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [otherDrafts, setOtherDrafts] = useState<Draft[]>([]);
  const otherDraftsRef = useRef<Draft[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [detail, setDetail] = useState<Entry | null>(null);
  const ready = useRef(false);
  const accept = useCallback((data: Envelope) => {
    if (!envelopeRef.current || data.version > envelopeRef.current.version) {
      envelopeRef.current = data;
      setEnvelope(data);
      try {
        localStorage.setItem("xia-campaign-cache", JSON.stringify(data));
      } catch {}
    }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/campaign", { cache: "no-store" });
      if (!response.ok) throw new Error();
      accept(await response.json());
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [accept]);
  // Hydrate device-owned external storage only after SSR to keep server and first client render identical.

  useEffect(() => {
    try {
      const cached = localStorage.getItem("xia-campaign-cache");
      if (cached) accept(JSON.parse(cached));
      const d = localStorage.getItem("xia-build-draft");
      if (d) {
        draftRef.current = JSON.parse(d);
        setDraftState(draftRef.current);
      }
      const bank = JSON.parse(
        localStorage.getItem("xia-other-drafts") ?? "[]",
      ) as Draft[];
      otherDraftsRef.current = bank;
      setOtherDrafts(bank);
      setSelected(
        new URLSearchParams(location.search).get("character") ??
          localStorage.getItem("xia-selected") ??
          "",
      );
      setDmState(localStorage.getItem("xia-mode") === "dm");
      const requestedView = new URLSearchParams(location.search).get("view");
      if (
        requestedView &&
        ["角色", "资料库", "队伍", "先攻", "主持台"].includes(requestedView)
      )
        setView(requestedView);
    } catch {}
    ready.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3000);
    const onOnline = () => void refresh();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onOnline);
    };
  }, [accept, refresh]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        const urls = performance
          .getEntriesByType("resource")
          .map((x) => x.name);
        (
          navigator.serviceWorker.controller ?? registration.active
        )?.postMessage({ type: "CACHE_SHELL", urls });
      })
      .catch(() => {});
  }, []);
  const select = (id: string) => {
    setSelected(id);
    localStorage.setItem("xia-selected", id);
  };
  const setDm = (v: boolean) => {
    setDmState(v);
    localStorage.setItem("xia-mode", v ? "dm" : "player");
  };
  const setDraft = (d: Draft | null) => {
    const current = draftRef.current;
    let bank = otherDraftsRef.current.filter((x) => x.id !== d?.id);
    if (d && current && d.id !== current.id)
      bank = [...bank.filter((x) => x.id !== current.id), current];
    otherDraftsRef.current = bank;
    setOtherDrafts(bank);
    draftRef.current = d;
    setDraftState(d);
    try {
      localStorage.setItem(
        "xia-other-drafts",
        JSON.stringify(otherDraftsRef.current),
      );
      if (d) localStorage.setItem("xia-build-draft", JSON.stringify(d));
      else localStorage.removeItem("xia-build-draft");
    } catch {
      setError("设备空间不足，草稿暂时只保存在当前页面。请导出或保存方案。");
    }
  };
  const character = envelope?.campaign.characters.find(
    (x) => x.id === selected,
  );
  const startDraft = (ch?: Character, step?: number) => {
    setNotice("");
    setError("");
    const remembered = ch
      ? [draft, ...otherDrafts].find((x) => x?.id === ch.id)
      : draft?.isNew
        ? draft
        : undefined;
    if (remembered) {
      setDraft(step === undefined ? remembered : { ...remembered, step });
      setBuilderOpen(true);
      return;
    }
    setError("");
    setDraft(
      ch
        ? {
            id: ch.id,
            revision: ch.revision,
            build: structuredClone(ch.build),
            isNew: false,
            step,
          }
        : {
            id: crypto.randomUUID(),
            revision: 0,
            build: emptyBuild(),
            isNew: true,
          },
    );
    setBuilderOpen(true);
  };
  const trial = (entry: Entry, level = 1) => {
    const d =
      draft ??
      (character
        ? {
            id: character.id,
            revision: character.revision,
            build: structuredClone(character.build),
            isNew: false,
          }
        : {
            id: crypto.randomUUID(),
            revision: 0,
            build: emptyBuild(),
            isNew: true,
          });
    if (entry.kind === "background" && d.isNew) {
      const changed = changeDraftBackground(
        d.build,
        entry.id,
        d.backgroundGrant,
      );
      setDraft({ ...d, build: changed.build, backgroundGrant: changed.grant });
    } else
      setDraft({
        ...d,
        build:
          entry.kind === "equipment"
            ? addPossession(d.build, entry)
            : addEntry(d.build, entry, level),
      });
    setNotice(`《${entry.name}》已加入试配草稿，正式角色尚未改变。`);
  };
  const mutate = async (type: string, payload: unknown) => {
    if (busyRef.current) return false;
    if (!online || !navigator.onLine || !envelopeRef.current) {
      setError("共享存档未连接。可以继续浏览和试配，恢复连接后再保存。");
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    const requestId = crypto.randomUUID();
    const command = {
      type,
      payload,
      requestId,
      expectedVersion: envelopeRef.current.version,
      role: dm ? "dm" : "player",
      by: dm ? "主持人" : (character?.build.name ?? "新侠士"),
    };
    try {
      // A network retry reuses the exact request ID, preventing a second debit if the first response was lost.
      let response: Response;
      try {
        response = await fetch("/api/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
      } catch {
        response = await fetch("/api/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
      }
      const data = (await response.json()) as Envelope & { error?: string };
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(data.error ?? "保存失败。");
      }
      accept(data);
      setNotice("已保存到本团，其他设备会自动更新。");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败。");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return {
    otherDrafts,
    duplicate: (ch) => {
      setNotice("已复制到独立草稿，确认后才会建立新角色。");
      setError("");
      const build = structuredClone(ch.build);
      build.name = (build.name + " · 副本").slice(0, 40);
      setDraft({
        id: crypto.randomUUID(),
        revision: 0,
        build,
        isNew: true,
        step: 5,
      });
      setBuilderOpen(true);
    },
    campaign: envelope?.campaign ?? null,
    version: envelope?.version ?? 0,
    selected,
    select,
    dm,
    setDm,
    view,
    setView,
    character,
    online,
    loading,
    busy,
    error,
    notice,
    setError,
    setNotice,
    mutate,
    refresh,
    draft,
    setDraft,
    builderOpen,
    setBuilderOpen,
    startDraft,
    trial,
    detail,
    setDetail,
  };
}
