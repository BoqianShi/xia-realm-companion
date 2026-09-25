"use client";
import { HostContext } from "./host-context";
import { useState } from "react";
import {
  Monitor,
  ChevronRight,
  Plus,
  BookOpen,
  NotebookPen,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import {
  useHost,
  HostModal,
  useHostDraft,
  DraftConflict,
  useModuleContent,
  statusLabels,
} from "./host-shared";
import { AdventureEncounterLibrary } from "./adventure-encounters";
import { ModuleShelf } from "./modules";
import { ModulePeople } from "./module-people";
import { ModuleUnitPicker } from "./initiative-board";
import { modules } from "@/lib/modules";
import { visibleUnit, type Scene } from "@/lib/hosting";
const sections = ["现场", "关联与场次", "场景与线索", "遭遇预设", "模组与人物"];
const screenNames = {
  standby: "待机",
  initiative: "先攻与状态",
  text: "场景文字",
  image: "场景图片",
};
export function HostConsole() {
  const { a, h, send, disabled } = useHost(),
    [tab, setTab] = useState("现场"),
    [sessionOpen, setSessionOpen] = useState(false),
    [scene, setScene] = useState<Scene | null>(null),
    [picker, setPicker] = useState(false),
    [showArchived, setShowArchived] = useState(false),
    [moduleId, setModule] = useState(modules[0].id),
    [query, setQuery] = useState("");
  const { data: moduleData, error: moduleError } = useModuleContent(
    tab === "模组与人物" ? moduleId : "",
  );
  if (!a.dm)
    return (
      <section className="paper panel">
        <h1>DM 主持台</h1>
        <p>准备场景、查阅模组与安排桌上的行动顺序。</p>
        <button className="button primary" onClick={() => a.setDm(true)}>
          进入主持人视图
        </button>
      </section>
    );
  const current = h.scenes.find((s) => s.id === h.activeSceneId && !s.archived),
    active = h.board.units.find((u) => u.id === h.board.activeId),
    newScene = () =>
      setScene({
        id: crypto.randomUUID(),
        title: "新场景",
        kind: "scene",
        text: "",
        dmNotes: "",
        image: "",
        moduleId: "",
        sourcePage: null,
        archived: false,
      });
  return (
    <div className="host-console">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DM 主持台 · {a.campaign?.name}</p>
          <h1>{h.session.title}</h1>
          <p className="muted">{h.session.date || "还未填写本次日期"}</p>
        </div>
        <div className="button-group">
          <button className="button" onClick={() => setSessionOpen(true)}>
            <NotebookPen size={17} />
            备团与收团
          </button>
          <a className="button" href="/screen" target="_blank" rel="noreferrer">
            <Monitor size={17} />
            打开大屏
          </a>
        </div>
      </div>
      <nav className="host-tabs" aria-label="主持台栏目">
        {sections.map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "关联与场次" && <HostContext />}
      {tab === "现场" && (
        <>
          <div className="host-dashboard-grid">
            <section className="paper panel host-current-encounter">
              <small>当前遭遇 · {statusLabels[h.board.status]}</small>
              <h2>{h.board.title}</h2>
              <p className="host-current-name">
                {h.board.trackingMode !== "turn" && ["running", "paused"].includes(h.board.status) ? "按整轮记录" : active && a.campaign
                  ? visibleUnit(a.campaign, active).name
                  : "尚未开始行动"}
              </p>
              <p>
                {h.board.units.length} 位行动单位 · 第 {h.board.round || "—"} 轮
              </p>
              <button
                className="button primary"
                onClick={() => a.setView("先攻")}
              >
                进入先攻
                <ChevronRight size={16} />
              </button>
            </section>
            <section className="paper panel">
              <small>投屏控制 · 正在显示{screenNames[h.screen.mode]}</small>
              <h2>{h.screen.title || "桌边大屏"}</h2>
              <p className="host-hint">
                战况随角色记录同步；场景需点击展示后更新。
              </p>
              <div className="button-group">
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() =>
                    void send({ kind: "publish", mode: "initiative" })
                  }
                >
                  展示战况
                </button>
                <button
                  className="button"
                  disabled={disabled || h.screen.mode === "standby"}
                  onClick={() =>
                    void send({ kind: "publish", mode: "standby" })
                  }
                >
                  回到待机
                </button>
              </div>
              {h.screen.publishedAt && (
                <small>
                  上次切换{" "}
                  {new Date(h.screen.publishedAt).toLocaleTimeString("zh-CN")}
                </small>
              )}
            </section>
          </div>
          <div className="host-live-grid">
            <section className="paper panel host-current-scene">
              <div className="section-heading">
                <div>
                  <small>当前场景</small>
                  <h2>{current?.title ?? "选择接下来发生的事"}</h2>
                </div>
                <button className="button" onClick={() => setTab("场景与线索")}>
                  切换场景
                </button>
              </div>
              {current ? (
                <>
                  <p className="host-scene-text">
                    {current.text || "尚未填写可朗读的文字。"}
                  </p>
                  {current.image && (
                    <img
                      className="host-scene-preview"
                      src={current.image}
                      alt={current.title}
                    />
                  )}
                  <div className="button-group">
                    <button
                      className="button primary"
                      disabled={disabled || !current.text.trim()}
                      onClick={() =>
                        void send({
                          kind: "publish",
                          mode: "text",
                          sceneId: current.id,
                        })
                      }
                    >
                      向玩家展示文字
                    </button>
                    <button
                      className="button"
                      disabled={disabled || !current.image}
                      onClick={() =>
                        void send({
                          kind: "publish",
                          mode: "image",
                          sceneId: current.id,
                        })
                      }
                    >
                      向玩家展示图片
                    </button>
                    <button
                      className="button"
                      onClick={() => setScene(current)}
                    >
                      编辑场景
                    </button>
                  </div>
                  {current.dmNotes && (
                    <aside className="host-dm-note">
                      <b>主持人备注 · 不投屏</b>
                      <p>{current.dmNotes}</p>
                    </aside>
                  )}
                  {current.moduleId && (
                    <a
                      className="text-button"
                      href={`/adventures/${current.moduleId}${current.sourcePage ? `?page=${current.sourcePage}` : ""}`}
                    >
                      打开对应模组
                      {current.sourcePage
                        ? ` · PDF 第 ${current.sourcePage} 页`
                        : ""}{" "}
                      →
                    </a>
                  )}
                </>
              ) : (
                <>
                  <p className="host-hint">
                    从模组整理场景、线索与要展示的图片，在这里留出主持人自己的提醒。
                  </p>
                  <button className="button" onClick={newScene}>
                    <Plus size={17} />
                    创建第一个场景
                  </button>
                </>
              )}
            </section>
            <aside className="host-notes-column">
              <section className="paper panel">
                <div className="section-heading">
                  <h2>备团提纲</h2>
                  <button
                    className="text-button"
                    onClick={() => setSessionOpen(true)}
                  >
                    编辑
                  </button>
                </div>
                <p className="preserve">
                  {h.session.outline ||
                    "按场景记下今天的路线、关键人物和待触发事件。"}
                </p>
              </section>
              <section className="paper panel">
                <h2>现场速记</h2>
                <p className="preserve">
                  {h.session.notes || "人物临时决定、未解决的裁定和后续线索。"}
                </p>
                <button className="button" onClick={() => setSessionOpen(true)}>
                  记录
                </button>
              </section>
              <button className="button" onClick={() => a.setView("队伍")}>
                <Users size={16} />
                查看全队角色与资源
              </button>
            </aside>
          </div>
        </>
      )}
      {tab === "场景与线索" && (
        <>
          <div className="host-section-toolbar">
            <div>
              <h2>场景与线索</h2>
              <p className="muted">正文供现场朗读；主持人备注只留在主持台。</p>
            </div>
            <button className="button primary" onClick={newScene}>
              <Plus size={17} />
              新建
            </button>
          </div>
          <label className="host-check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            显示已归档场景
          </label>
          <div className="host-scene-grid">
            {h.scenes
              .filter((s) => showArchived || !s.archived)
              .map((s) => (
                <article className="paper panel" key={s.id}>
                  <div className="entry-meta">
                    <span>{s.kind === "scene" ? "场景" : "线索"}</span>
                    {s.archived && <span>已归档</span>}
                    {s.id === h.activeSceneId && <span>当前场景</span>}
                  </div>
                  <h2>{s.title}</h2>
                  <p>
                    {s.text.slice(0, 130) || "还没有正文"}
                    {s.text.length > 130 ? "…" : ""}
                  </p>
                  {s.image && (
                    <small>
                      <ImageIcon size={13} /> 已附图片
                    </small>
                  )}
                  <div className="button-group">
                    <button className="button" onClick={() => setScene(s)}>
                      查看与编辑
                    </button>
                    <button
                      className="button primary"
                      disabled={disabled || s.archived}
                      onClick={async () => {
                        if (await send({ kind: "activeScene", id: s.id }))
                          setTab("现场");
                      }}
                    >
                      设为当前场景
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!h.scenes.length && (
            <p className="host-empty">
              暂未建立场景。可以从已导入的模组提取朗读文字，再附上地图。
            </p>
          )}
        </>
      )}
      {tab === "遭遇预设" && (
        <>
          <AdventureEncounterLibrary />
          <div className="host-section-toolbar">
            <div>
              <h2>自定义阵容</h2>
              <p className="muted">
                在先攻页排好团员与敌人后，点击“保存为遭遇预设”。
              </p>
            </div>
            <button className="button" onClick={() => a.setView("先攻")}>
              准备一场遭遇
            </button>
          </div>
          <div className="host-scene-grid">
            {h.presets
              .filter((p) => !p.sourceId)
              .map((p) => (
                <article className="paper panel" key={p.id}>
                  <h2>{p.name}</h2>
                  <p>{p.units.map((u) => u.name).join("、")}</p>
                  <small>{p.units.length} 位单位 · 每份敌人独立记资源</small>
                  <button
                    className="button primary"
                    disabled={
                      disabled || ["running", "paused"].includes(h.board.status)
                    }
                    onClick={async () => {
                      if (await send({ kind: "presetLoad", id: p.id }))
                        a.setView("先攻");
                    }}
                  >
                    载入先攻
                  </button>
                </article>
              ))}
          </div>
          {!h.presets.length && (
            <p className="host-empty">
              自定义阵容可在先攻页保存；剧本预设直接从上方导入。
            </p>
          )}
          <details className="host-history">
            <summary>历史遭遇 · {h.archives.length} 场</summary>
            {h.archives.map((ar) => (
              <section className="paper panel" key={ar.id}>
                <h3>{ar.board.title}</h3>
                <p>
                  {new Date(ar.at).toLocaleString("zh-CN")} · {ar.board.round}{" "}
                  轮
                </p>
                <p>
                  {ar.board.units
                    .map((u) => `${u.name}${u.out ? "（退场）" : ""}`)
                    .join("、")}
                </p>
              </section>
            ))}
          </details>
        </>
      )}
      {tab === "模组与人物" && (
        <>
          <ModuleShelf />
          <section className="paper panel host-monster-library">
            <div className="section-heading">
              <div>
                <p className="eyebrow">主持人资料</p>
                <h2>模组人物与怪物</h2>
              </div>
              <button className="button" onClick={() => setPicker(true)}>
                选择人物加入先攻
              </button>
            </div>
            <div className="host-picker-controls">
              <label className="field">
                模组
                <select
                  value={moduleId}
                  onChange={(e) => setModule(e.target.value)}
                >
                  {modules.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                搜索
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="姓名、属性、招式"
                />
              </label>
            </div>
            {moduleError && <p>{moduleError}</p>}
            {moduleData ? (
              <ModulePeople module={moduleData} query={query} />
            ) : (
              <p role="status">正在读取人物…</p>
            )}
          </section>
        </>
      )}
      {sessionOpen && <SessionEditor close={() => setSessionOpen(false)} />}
      {scene && (
        <SceneEditor
          key={scene.id}
          scene={scene}
          close={() => setScene(null)}
        />
      )}
      {picker && (
        <ModuleUnitPicker
          close={() => {
            setPicker(false);
            a.setView("先攻");
          }}
        />
      )}
    </div>
  );
}
function SessionEditor({ close }: { close: () => void }) {
  const { h, send, disabled } = useHost(),
    [sessionId] = useState(h.activeSessionId ?? "legacy-session"),
    session = h.sessions?.find(s => s.id === sessionId) ?? h.session,
    d = useHostDraft(`xia-host-session-draft:${sessionId}`, session, h.revision),
    v = d.value;
  return (
    <HostModal
      wide
      title="本次备团与收团"
      close={close}
      description="提纲与现场记录留在主持台；收团摘要保存后会出现在队伍页。输入会保留为本机草稿。"
    >
      <div className="host-fields">
        <label className="field">
          本次标题
          <input
            value={v.title}
            maxLength={100}
            onChange={(e) => d.setValue({ ...v, title: e.target.value })}
          />
        </label>
        <label className="field">
          日期
          <input
            type="date"
            value={v.date}
            onChange={(e) => d.setValue({ ...v, date: e.target.value })}
          />
        </label>
      </div>
      {(
        [
          ["outline", "备团提纲", 20000],
          ["notes", "现场记录 · 不投屏", 30000],
          ["recap", "收团摘要 · 队伍可见", 20000],
        ] as const
      ).map(([k, label, max]) => (
        <label className="field" key={k}>
          {label}
          <textarea
            rows={6}
            maxLength={max}
            value={v[k]}
            onChange={(e) => d.setValue({ ...v, [k]: e.target.value })}
          />
        </label>
      ))}
      <DraftConflict conflict={d.conflict} rebase={d.rebase} />
      {sessionId !== (h.activeSessionId ?? "legacy-session") && <p className="warning">另一台设备切换了场次。输入仍保留，请关闭并返回原场次继续编辑。</p>}
      <button
        className="button primary"
        disabled={disabled || !d.ready || d.conflict || !v.title.trim() || sessionId !== (h.activeSessionId ?? "legacy-session")}
        onClick={async () => {
          if (await send({ kind: "session", sessionId, value: v }, d.base)) {
            d.clear();
            close();
          }
        }}
      >
        保存本次记录
      </button>
    </HostModal>
  );
}
function SceneEditor({ scene, close }: { scene: Scene; close: () => void }) {
  const { h, send, disabled } = useHost(),
    isNew = !h.scenes.some((s) => s.id === scene.id),
    d = useHostDraft(
      `xia-scene-draft-${isNew ? "new" : scene.id}`,
      scene,
      h.revision,
    ),
    v = d.value,
    patch = (p: Partial<Scene>) => d.setValue({ ...v, ...p });
  const { data, error } = useModuleContent(v.moduleId);
  const assets =
    data?.assets.filter((a) => /\.(png|jpe?g|webp)$/i.test(a.url)) ?? [];
  return (
    <HostModal
      wide
      title={isNew ? "新建场景或线索" : `编辑 · ${scene.title}`}
      close={close}
      description="大屏只展示你明确发布的正文或图片。之后编辑草稿不会改变已发布的画面。"
    >
      <div className="host-fields">
        <label className="field">
          标题
          <input
            value={v.title}
            maxLength={100}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label className="field">
          类型
          <select
            value={v.kind}
            onChange={(e) => patch({ kind: e.target.value as Scene["kind"] })}
          >
            <option value="scene">场景</option>
            <option value="clue">线索</option>
          </select>
        </label>
      </div>
      <label className="field">
        向玩家朗读／展示的正文
        <textarea
          rows={9}
          maxLength={20000}
          value={v.text}
          onChange={(e) => patch({ text: e.target.value })}
        />
      </label>
      <label className="field">
        主持人备注 · 不投屏
        <textarea
          rows={5}
          maxLength={16000}
          value={v.dmNotes}
          onChange={(e) => patch({ dmNotes: e.target.value })}
          placeholder="人物的秘密、检定条件、现场分支…"
        />
      </label>
      <div className="host-fields">
        <label className="field">
          关联模组
          <select
            value={v.moduleId}
            onChange={(e) =>
              patch({ moduleId: e.target.value, image: "", sourcePage: null })
            }
          >
            <option value="">不关联</option>
            {modules.map((m) => (
              <option value={m.id} key={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          原 PDF 页码
          <input
            type="number"
            min={1}
            max={data?.pages.length ?? 10000}
            value={v.sourcePage ?? ""}
            onChange={(e) =>
              patch({
                sourcePage: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
      </div>
      {v.moduleId && (
        <label className="field">
          展示图片
          <select
            value={v.image}
            onChange={(e) => patch({ image: e.target.value })}
          >
            <option value="">不附图片</option>
            <optgroup label="模组地图与插图">
              {assets.map((a) => (
                <option value={a.url} key={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="原书页面（发布前请核对是否含剧情答案）">
              {data?.pages.map((p) => (
                <option value={p.image} key={p.number}>
                  PDF 第 {p.number} 页
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      )}
      {error && <p>{error}</p>}
      {v.image && (
        <img
          className="host-scene-preview"
          src={v.image}
          alt="选中的投屏图片"
        />
      )}
      <label className="host-check">
        <input
          type="checkbox"
          checked={v.archived}
          onChange={(e) => patch({ archived: e.target.checked })}
        />
        归档此场景（保留内容）
      </label>
      <DraftConflict conflict={d.conflict} rebase={d.rebase} />
      <div className="button-group">
        <button
          className="button primary"
          disabled={disabled || !d.ready || d.conflict || !v.title.trim()}
          onClick={async () => {
            if (await send({ kind: "scene", value: v }, d.base)) {
              d.clear();
              close();
            }
          }}
        >
          保存草稿
        </button>
        {v.moduleId && (
          <a
            className="button"
            href={`/adventures/${v.moduleId}${v.sourcePage ? `?page=${v.sourcePage}` : ""}`}
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={16} />
            核对模组原文
          </a>
        )}
      </div>
    </HostModal>
  );
}
