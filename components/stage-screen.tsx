"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import type { ScreenProjection } from "@/lib/hosting";
import { statusLabels } from "./host-shared";
import { Portrait } from "./person-portrait";

type ScreenUnit = ScreenProjection["board"]["units"][number];

function ResourceBar({ label, value, max, kind }: {
  label: string; value: number | null; max: number | null; kind: "hp" | "mp";
}) {
  const percent = value !== null && max !== null && max > 0
    ? Math.max(0, Math.min(100, value / max * 100)) : null;
  return (
    <div className={`screen-resource screen-resource-${kind}`}>
      <div><span>{label}</span><strong>{value ?? "未记录"}<small> / {max ?? "—"}</small></strong></div>
      {percent !== null && <div className="screen-resource-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>}
    </div>
  );
}

function UnitCard({ unit: u, current }: { unit: ScreenUnit; current: boolean }) {
  return (
    <li className={`${current ? "is-current" : ""} ${u.out ? "is-out" : ""}`} aria-current={current ? "step" : undefined}>
      <div className="screen-unit-heading">
        <div className="screen-unit-score"><strong>{u.score ?? "—"}</strong><small>先攻</small></div>
        {u.portrait && <Portrait src={u.portrait} name={u.name} />}
        <div><h2>{u.name}</h2><span>{u.out ? "已退场" : current ? "当前行动" : u.side === "player" ? "侠士" : u.side === "ally" ? "友方" : "对手"}</span></div>
      </div>
      {u.showDetails ? <>
        <div className="screen-unit-vitals">
        <div className="screen-unit-resources">
          <ResourceBar label={u.healthLabel} value={u.hp} max={u.hpMax} kind="hp" />
          <ResourceBar label="内力" value={u.mp} max={u.mpMax} kind="mp" />
        </div>
        <div className="screen-unit-extras">
          {u.shield !== null && <span>护体 <b>{u.shield}</b></span>}
          {u.rage !== null && <span>怒气 <b>{u.rage}</b></span>}
          {u.inner && <span>运功 · {u.inner}</span>}
        </div>
        </div>
        <div className="screen-unit-stance">
          <span>架招／挂招</span>
          {u.stance ? <>
            <strong>{u.stance.name}</strong>{u.stance.block !== null && <small>基础格挡 {u.stance.block}</small>}
            {u.stance.summary && <p>{u.stance.summary}</p>}
          </> : <small>未记录架招</small>}
        </div>
        <div className="screen-unit-effects" aria-label="状态与增益">
          {u.statuses.map((s) => <div className="screen-effect" key={s.id}>
            <strong>{s.name}{s.stacks > 1 ? ` ×${s.stacks}` : ""}</strong>
            <p>{s.effect?.text ?? "效果尚未填写"}</p>
            {s.effect?.stageDependent && <small>原文参考 · 本次施展阶段由桌上确认</small>}
            <small>{s.remaining === null ? "手动移除" : `${s.anchor || "待填参照者"} · 第${s.remaining}个回合开始结束`}</small>
          </div>)}
          {!u.statuses.length && u.conditions && <p className="screen-effect-text">{u.conditions}</p>}
          {u.counters.map((c) => <div className="screen-effect" key={c.id}><strong>{c.name} ×{c.value}</strong><p>{c.effect?.text ?? "效果尚未填写"}</p></div>)}
          {!u.statuses.length && !u.conditions && !u.counters.length && <small className="screen-no-effects">暂无状态记录</small>}
        </div>
      </> : <p className="screen-details-hidden">气血与状态未公开</p>}
    </li>
  );
}

export default function StageScreen() {
  const [data, setData] = useState<ScreenProjection | null>(null),
    [online, setOnline] = useState(true),
    [full, setFull] = useState(false);
  useEffect(() => {
    let stopped = false,
      busy = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const r = await fetch("/api/screen", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw Error();
        const d = (await r.json()) as ScreenProjection;
        if (!stopped) {
          setData(d);
          setOnline(true);
        }
      } catch {
        if (!stopped) setOnline(false);
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3000);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    window.addEventListener("online", refresh);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", fs);
      window.removeEventListener("online", refresh);
    };
  }, []);
  const b = data?.board,
    current = b?.units.find((u) => u.id === b.activeId),
    next = b?.units.find((u) => u.id === b.nextId);
  return (
    <main className="stage-screen">
      <header>
        <Link href="/?view=先攻">
          侠界之旅 · {data?.campaign ?? "桌边大屏"}
        </Link>
        <div>
          {!online && <span role="status">连接中断 · 保留最后画面</span>}
          <button
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {}
            }}
            aria-label={full ? "退出全屏" : "全屏显示"}
          >
            {full ? <Minimize /> : <Maximize />}
          </button>
        </div>
      </header>
      {!data ? (
        <p role="status">正在读取投屏内容…</p>
      ) : data.mode === "standby" ? (
        <section className="stage-standby">
          <span>侠</span>
          <h1>{data.campaign}</h1>
          <p>等待主持人展示场景或战况</p>
        </section>
      ) : data.mode === "text" ? (
        <article className="stage-text">
          <h1>{data.title}</h1>
          <div>
            {data.text.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
      ) : data.mode === "image" ? (
        <section className="stage-image">
          <h1>{data.title}</h1>
          <img src={data.image} alt={data.title} />
        </section>
      ) : (
        <>
          <section className="stage-screen-turn" aria-live="polite">
            <div>
              <small>
                {b?.title} · {b ? statusLabels[b.status] : ""}
              </small>
              <h1>
                {b?.status === "setup"
                  ? "准备先攻"
                  : b?.status === "ended"
                    ? "本场遭遇结束"
                    : b?.trackingMode === "round" ? `第 ${b.round} 轮` : (current?.name ?? "由主持人处理当前回合")}
              </h1>
              {b?.trackingMode === "round" && ["running", "paused"].includes(b.status) && <p>整轮记录 · {b.units.length} 位出场人物</p>}
              {next && b?.status !== "setup" && b?.status !== "ended" && <p>随后 · {next.name}</p>}
            </div>
            {b?.trackingMode === "turn" && <div>
              <small>第</small>
              <strong>{b?.round || "—"}</strong>
              <small>轮</small>
            </div>}
          </section>
          <div className="screen-roster-labels" aria-hidden="true"><span>人物 · 先攻顺序</span><span>气血 · 内力 · 护体</span><span>当前架招与效果</span><span>状态与增益</span></div>
          <ol className="stage-screen-roster screen-roster-overview">
            {b?.units.map((u) => <UnitCard key={u.id} unit={u} current={u.id === b.activeId} />)}
          </ol>
          {!b?.units.length && <p>暂时没有公开的出场人物。</p>}
        </>
      )}
      <footer>由现场主持人裁定 · 状态与资源手动记录</footer>
    </main>
  );
}
