"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { AppContext, useApp, useAppState } from "./app-context";
import { modules } from "@/lib/modules";
import {
  chapterForPage,
  chapterPages,
  pageBlocks,
  readerSections,
  searchModule,
} from "@/lib/module-reader";
import type {
  ModuleContent,
  ModuleNotebook,
  ModuleTextBlock,
} from "@/lib/module-types";
import Link from "next/link";
import { LinkedText } from "./context-cards";
import { ModulePeople } from "./module-people";
import { ModuleNotes } from "./modules";

export default function ModuleWorkspace({ id }: { id: string }) {
  const a = useAppState();
  return (
    <AppContext.Provider value={a}>
      <Workspace id={id} />
    </AppContext.Provider>
  );
}
function Workspace({ id }: { id: string }) {
  const a = useApp(),
    summary = modules.find((m) => m.id === id);
  const [content, setContent] = useState<ModuleContent | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!summary) return;
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setError(false);
        setContent(null);
      }
    });
    fetch(
      `${summary.contentUrl}?v=${summary.contentRevision ?? summary.version}`,
      { signal: abort.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        const m = (await r.json()) as ModuleContent;
        if (m.id !== id || m.version !== summary.version) throw Error();
        setContent(m);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => abort.abort();
  }, [id, summary, retry]);
  if (!summary)
    return (
      <main className="reader-empty">
        <h1>没有这本模组</h1>
        <Link href="/?view=队伍#module-shelf">返回模组书架</Link>
      </main>
    );
  return (
    <div className="module-workspace">
      {!content || a.loading ? (
        <main className="reader-empty">
          <Link href="/?view=队伍#module-shelf">← 返回书架</Link>
          <h1>{summary.title}</h1>
          {error ? (
            <>
              <p role="alert">暂时无法读取资料，已保存的笔记不受影响。</p>
              <button className="button" onClick={() => setRetry((x) => x + 1)}>
                重试
              </button>
            </>
          ) : (
            <p role="status">正在打开模组…</p>
          )}
        </main>
      ) : (
        <Reader
          key={id}
          m={content}
          notebook={a.campaign?.modules?.find((n) => n.id === id)}
        />
      )}
    </div>
  );
}
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const needle = query.trim().toLowerCase(),
    parts = [];
  let at = 0,
    index = text.toLowerCase().indexOf(needle);
  while (index >= 0) {
    parts.push(
      text.slice(at, index),
      <mark key={index}>{text.slice(index, index + needle.length)}</mark>,
    );
    at = index + needle.length;
    index = text.toLowerCase().indexOf(needle, at);
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}
function ProseBlock({
  block,
  query,
  moduleId,
}: {
  moduleId: string;
  block: ModuleTextBlock;
  query: string;
}) {
  const children = block.spans.map((s, i) => (
    <span
      key={i}
      className={`${s.bold ? "prose-strong" : ""} ${s.tone ? `prose-${s.tone}` : ""}`}
    >
      {query ? (
        <Highlight text={s.text} query={query} />
      ) : (
        <LinkedText text={s.text} moduleId={moduleId} />
      )}
    </span>
  ));
  if (block.kind === "heading") return <h3>{children}</h3>;
  if (block.kind === "subheading") return <h4>{children}</h4>;
  if (block.kind === "dialogue")
    return <blockquote className="reader-dialogue">{children}</blockquote>;
  return <p className={`reader-${block.kind}`}>{children}</p>;
}
function OriginalPage({
  m,
  page,
}: {
  m: ModuleContent;
  page: ModuleContent["pages"][number];
}) {
  const [open, setOpen] = useState(false);
  if (!m.pdf && !page.image) return null;
  return (
    <details
      className="reader-original"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>核对本页原书 / 插图</summary>
      {open && (
        <>
          <a
            href={m.pdf ? `${m.pdf}#page=${page.number}` : undefined}
            target="_blank"
            rel="noreferrer"
          >
            打开 PDF · 第 {page.printed ?? page.number} 页
          </a>
          {page.image && <a href={page.image} target="_blank" rel="noreferrer">
            <img
              src={page.image}
              alt={`${m.title}原书第${page.printed ?? page.number}页`}
              loading="lazy"
            />
          </a>}
        </>
      )}
    </details>
  );
}
function PageProse({
  blocks,
  query,
  chapterTitle,
  moduleId,
}: {
  moduleId: string;
  blocks: ModuleTextBlock[];
  query: string;
  chapterTitle?: string;
}) {
  const titleKey = (s: string) => s.replace(/[\s·：:]/g, "");
  const visible = blocks.filter(
    (b, i) =>
      !(
        i === 0 &&
        b.kind === "heading" &&
        chapterTitle &&
        titleKey(b.text) === titleKey(chapterTitle)
      ),
  );
  const groups: ModuleTextBlock[][] = [];
  for (const block of visible) {
    const last = groups.at(-1);
    if (block.kind === "note" && last?.[0].kind === "note") last.push(block);
    else groups.push([block]);
  }
  return groups.map((group, i) =>
    group.length > 1 ? (
      <aside className="reader-scene-notes" aria-label="场景提示" key={i}>
        {group.map((block, j) => (
          <ProseBlock key={j} block={block} query={query} moduleId={moduleId} />
        ))}
      </aside>
    ) : (
      <ProseBlock key={i} block={group[0]} query={query} moduleId={moduleId} />
    ),
  );
}
function Reader({
  m,
  notebook: n,
}: {
  m: ModuleContent;
  notebook?: ModuleNotebook;
}) {
  const a = useApp(),
    sections = readerSections(m);
  const [chapterId, setChapterId] = useState(
    chapterForPage(m, n?.bookmark ?? m.sections[0].page).id,
  );
  const [tab, setTab] = useState("正文"),
    [query, setQuery] = useState(""),
    [peopleQuery, setPeopleQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false),
    [size, setSize] = useState(19),
    [wide, setWide] = useState(false);
  const [activePage, setActivePage] = useState(
      n?.bookmark ?? m.sections[0].page,
    ),
    [jump, setJump] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(""),
    [assetKind, setAssetKind] = useState("地图");
  const ready = useRef(false),
    scrolls = useRef<Record<string, number>>({}),
    header = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(135);
  useEffect(() => {
    if (!header.current) return;
    const observer = new ResizeObserver(() =>
      setHeaderHeight(header.current?.getBoundingClientRect().height ?? 135),
    );
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  const chapter = sections.find((s) => s.id === chapterId) ?? sections[0],
    index = sections.indexOf(chapter);
  const pages = chapterPages(m, chapter.id),
    hits = searchModule(m, query);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(location.search),
        requested = params.get("chapter"),
        page = Number(params.get("page"));
      const section = sections.find((s) => s.id === requested);
      const validPage =
        Number.isInteger(page) && page >= 1 && page <= m.pages.length;
      setChapterId(
        validPage
          ? chapterForPage(m, page).id
          : (section?.id ??
              chapterForPage(m, n?.bookmark ?? m.sections[0].page).id),
      );
      setJump(
        validPage ? page : (section?.page ?? n?.bookmark ?? m.sections[0].page),
      );
      setTab("正文");
    };
    queueMicrotask(() => {
      restore();
      try {
        const saved = JSON.parse(
          localStorage.getItem("xia-reader-settings") ?? "null",
        );
        if (saved) {
          if ([17, 19, 22].includes(saved.size)) setSize(saved.size);
          setWide(saved.wide === true);
        }
      } catch {}
      ready.current = true;
    });
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
    // The source and initial bookmark are fixed on opening; shared notebook updates must not move the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id]);
  useEffect(() => {
    if (ready.current)
      try {
        localStorage.setItem(
          "xia-reader-settings",
          JSON.stringify({ size, wide }),
        );
      } catch {}
  }, [size, wide]);
  useEffect(() => {
    if (tab !== "正文") return;
    const frame = requestAnimationFrame(() => {
      if (jump !== null) {
        const target =
          jump === chapter.page ? "reader-content" : `source-page-${jump}`;
        document.getElementById(target)?.scrollIntoView({ block: "start" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterId, chapter.page, jump, tab]);
  useEffect(() => {
    if (tab !== "正文") return;
    let frame = 0;
    const track = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchors = [
          ...document.querySelectorAll<HTMLElement>("[data-source-page]"),
        ];
        const current =
          anchors
            .filter(
              (el) =>
                el.getBoundingClientRect().top <=
                (header.current?.getBoundingClientRect().height ?? 135) + 50,
            )
            .at(-1) ?? anchors[0];
        if (current) setActivePage(Number(current.dataset.sourcePage));
      });
    };
    track();
    window.addEventListener("scroll", track, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", track);
    };
  }, [chapterId, tab]);
  const go = (page: number) => {
    const section = chapterForPage(m, page);
    setChapterId(section.id);
    setActivePage(page);
    setJump(page);
    setTab("正文");
    setMenuOpen(false);
    history.pushState(
      null,
      "",
      `/adventures/${m.id}?chapter=${section.id}&page=${page}`,
    );
    requestAnimationFrame(() =>
      document
        .getElementById(
          page === section.page ? "reader-content" : `source-page-${page}`,
        )
        ?.scrollIntoView({ block: "start" }),
    );
  };
  const changeTab = (next: string) => {
    scrolls.current[tab] = window.scrollY;
    setTab(next);
    setMenuOpen(false);
    // Returning to prose restores the same position instead of jumping back to the chapter start.
    setJump(null);
    requestAnimationFrame(() =>
      window.scrollTo({ top: scrolls.current[next] ?? 0 }),
    );
  };
  const save = async (payload: Record<string, unknown>) => {
    if (!n) return;
    const ok = await a.mutate("saveModule", {
      id: n.id,
      revision: n.revision,
      ...payload,
    });
    setFeedback(ok ? "已保存到本团" : "未保存；请核对最新记录后重试。");
  };
  return (
    <>
      <a className="reader-skip" href="#reader-content">
        跳到正文
      </a>
      <header className="reader-header" ref={header}>
        <div className="reader-header-main">
          <Link className="reader-back" href="/?view=队伍#module-shelf">
            <ArrowLeft size={18} />
            <span>书架</span>
          </Link>
          <div className="reader-book-title">
            <span>DM 备团 · {m.edition}</span>
            <h1>{m.title}</h1>
          </div>
          <div className="reader-header-actions">
            <span className="reader-sync">
              {a.online ? "共享存档已连接" : "离线阅读"}
            </span>
            <details className="reader-settings">
              <summary aria-label="阅读设置">
                <Settings2 size={19} />
                <span>阅读设置</span>
              </summary>
              <div>
                <b>字号</b>
                <div className="button-group">
                  {[
                    [17, "标准"],
                    [19, "舒适"],
                    [22, "大字"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      className="button"
                      aria-pressed={size === v}
                      onClick={() => setSize(Number(v))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <b>正文宽度</b>
                <div className="button-group">
                  <button
                    className="button"
                    aria-pressed={!wide}
                    onClick={() => setWide(false)}
                  >
                    适中
                  </button>
                  <button
                    className="button"
                    aria-pressed={wide}
                    onClick={() => setWide(true)}
                  >
                    宽版
                  </button>
                </div>
                <p>设置记在这台设备上。</p>
              </div>
            </details>
          </div>
        </div>
        <nav className="reader-tabs" aria-label="模组资料">
          {["正文", "人物", "地图与附件", "带团笔记"].map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => changeTab(t)}
            >
              {t}
            </button>
          ))}
          <button
            className="reader-menu-button"
            aria-expanded={menuOpen}
            aria-controls="reader-directory"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <List size={17} />
            目录 / 搜索
          </button>
        </nav>
      </header>
      {!a.dm && (
        <div className="reader-notice">
          这里含主持人剧情资料。
          <button className="button" onClick={() => a.setDm(true)}>
            进入主持人视图
          </button>
        </div>
      )}
      {!a.online && (
        <p className="reader-notice" role="status">
          当前离线，可阅读已缓存资料；笔记输入会保留为本机草稿。
        </p>
      )}
      {a.error && (
        <p className="reader-notice error" role="alert">
          {a.error}
          <button
            className="icon-button"
            aria-label="关闭错误提示"
            onClick={() => a.setError("")}
          >
            <X size={18} />
          </button>
        </p>
      )}
      <div
        className={`reader-layout ${wide ? "reader-wide" : ""}`}
        style={
          {
            "--reader-font": `${size}px`,
            "--reader-header-height": `${headerHeight}px`,
          } as CSSProperties
        }
      >
        <aside
          id="reader-directory"
          className={`reader-sidebar ${menuOpen ? "is-open" : ""}`}
          aria-label="章节与全文搜索"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMenuOpen(false);
              document
                .querySelector<HTMLButtonElement>(".reader-menu-button")
                ?.focus();
            }
          }}
        >
          <label className="reader-search">
            <Search size={17} />
            <input
              aria-label="搜索模组正文"
              placeholder="搜索本书人名、地点、线索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="清空正文搜索" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </label>
          {query.trim() ? (
            <div className="reader-hits">
              <p role="status">找到 {hits.length} 页</p>
              {hits.map((h) => (
                <button key={h.page} onClick={() => go(h.page)}>
                  <b>
                    {h.title}
                    <small>原书 {h.label} 页</small>
                  </b>
                  <span>
                    <Highlight text={h.snippet} query={query} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <nav className="reader-chapters" aria-label="章节目录">
              <h2>目录</h2>
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`?chapter=${s.id}&page=${s.page}`}
                  aria-current={
                    chapter.id === s.id && tab === "正文"
                      ? "location"
                      : undefined
                  }
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      go(s.page);
                    }
                  }}
                >
                  <span className="chapter-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    {s.title}
                    <small>
                      原书 {m.pages[s.page - 1].printed ?? s.page} 页
                      {n?.completed.includes(s.id) ? " · 已跑完" : ""}
                    </small>
                  </span>
                </a>
              ))}
            </nav>
          )}
          <details className="reader-source-note">
            <summary>版本与资料说明</summary>
            <p>{m.note}</p>
            {m.pdf && <a href={m.pdf} target="_blank" rel="noreferrer">打开完整 PDF</a>}
          </details>
        </aside>
        <main
          id="reader-content"
          className={`reader-main ${tab !== "正文" ? "reader-reference" : ""}`}
        >
          {!n && (
            <div className="reader-notice">
              加入本团后可保存书签和带团笔记。
              <button
                className="button"
                disabled={a.busy || !a.online || !a.dm}
                onClick={() => void a.mutate("importModules", { ids: [m.id] })}
              >
                导入本模组
              </button>
            </div>
          )}
          {n && n.sourceVersion !== m.version && (
            <p role="alert">
              当前资料版本与导入时不同，旧笔记已保留，请先核对版本。
            </p>
          )}
          {feedback && (
            <p className="reader-feedback" role="status">
              {feedback}
            </p>
          )}
          {tab === "正文" && (
            <>
              <div className="reader-chapter-title">
                <p className="eyebrow">{m.title} · 连续阅读</p>
                <h2>{chapter.title}</h2>
                <div className="reader-chapter-meta">
                  <span>
                    原书 {pages[0]?.printed ?? pages[0]?.number}
                    {pages.length > 1
                      ? `–${pages.at(-1)?.printed ?? pages.at(-1)?.number}`
                      : ""}{" "}
                    页
                  </span>
                  {n && (
                    <button
                      className="text-button"
                      disabled={!a.dm || !a.online || a.busy}
                      onClick={() => void save({ bookmark: activePage })}
                    >
                      <Bookmark size={16} />
                      记住当前页 ·{" "}
                      {m.pages[activePage - 1]?.printed ?? activePage}
                    </button>
                  )}
                </div>
              </div>
              <div className="reader-prose">
                {pages.map((p) => (
                  <section
                    id={`source-page-${p.number}`}
                    data-source-page={p.number}
                    key={p.number}
                    className="reader-source-page"
                  >
                    <div className="reader-page-label">
                      <span>原书 {p.printed ?? p.number} 页</span>
                      <a
                        href={m.pdf ? `${m.pdf}#page=${p.number}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {m.pdf ? "出处 ↗" : "资料包正文"}
                      </a>
                    </div>
                    {pageBlocks(p).length ? (
                      <PageProse
                        moduleId={m.id}
                        blocks={pageBlocks(p)}
                        query={query}
                        chapterTitle={
                          p.number === chapter.page ? chapter.title : undefined
                        }
                      />
                    ) : (
                      <p className="reader-illustration-note">
                        这一页以地图或图版为主，可展开下方原页查看。
                      </p>
                    )}
                    <OriginalPage m={m} page={p} />
                  </section>
                ))}
              </div>
              <div className="reader-chapter-end">
                {n && chapter.id !== "front-matter" && (
                  <button
                    className="button"
                    disabled={!a.dm || !a.online || a.busy}
                    onClick={() =>
                      void save({
                        completed: n.completed.includes(chapter.id)
                          ? n.completed.filter((id) => id !== chapter.id)
                          : [...n.completed, chapter.id],
                      })
                    }
                  >
                    {n.completed.includes(chapter.id)
                      ? "取消本章完成标记"
                      : "标记本章已跑完"}
                  </button>
                )}
                <a href="#reader-content">回到本章开头 ↑</a>
              </div>
              <nav className="reader-pagination" aria-label="章节翻页">
                <button
                  disabled={index === 0}
                  onClick={() => go(sections[index - 1].page)}
                >
                  <ChevronLeft size={19} />
                  <span>
                    上一章<b>{sections[index - 1]?.title ?? "已是第一章"}</b>
                  </span>
                </button>
                <button
                  disabled={index === sections.length - 1}
                  onClick={() => go(sections[index + 1].page)}
                >
                  <span>
                    下一章<b>{sections[index + 1]?.title ?? "全书结束"}</b>
                  </span>
                  <ChevronRight size={19} />
                </button>
              </nav>
            </>
          )}
          {tab === "人物" && (
            <>
              <div className="reader-chapter-title">
                <p className="eyebrow">{m.title}</p>
                <h2>人物与怪物</h2>
              </div>
              <label className="reader-search">
                <Search size={17} />
                <input
                  aria-label="搜索模组人物"
                  placeholder="姓名、属性、招式…"
                  value={peopleQuery}
                  onChange={(e) => setPeopleQuery(e.target.value)}
                />
              </label>
              <ModulePeople module={m} query={peopleQuery} />
            </>
          )}
          {tab === "地图与附件" && (
            <>
              <div className="reader-chapter-title">
                <p className="eyebrow">{m.title}</p>
                <h2>地图与附件</h2>
              </div>
              <div className="module-asset-filters">
                {["全部", "地图", "人物卡", "道具卡", "速查", "源文件"].map(
                  (k) => (
                    <button
                      className="button"
                      key={k}
                      aria-pressed={assetKind === k}
                      onClick={() => setAssetKind(k)}
                    >
                      {k}{" "}
                      {
                        m.assets.filter((x) => k === "全部" || x.kind === k)
                          .length
                      }
                    </button>
                  ),
                )}
              </div>
              <div className="module-gallery">
                {m.assets
                  .filter((x) => assetKind === "全部" || x.kind === assetKind)
                  .map((x, i) => (
                    <a
                      key={x.id + i}
                      href={x.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {x.preview ? (
                        <img src={x.preview} alt={x.name} loading="lazy" />
                      ) : (
                        <span className="module-file-icon">
                          {x.url.split(".").at(-1)?.toUpperCase()}
                        </span>
                      )}
                      <b>{x.name.split("/").at(-1)}</b>
                      <small>
                        {x.source ?? x.kind} ·{" "}
                        {x.preview ? "打开原图" : "下载原文件"}
                      </small>
                    </a>
                  ))}
              </div>
              {!m.assets.some(
                (x) => assetKind === "全部" || x.kind === assetKind,
              ) && <p>没有单独的{assetKind}附件，可在正文中展开对应原页。</p>}
            </>
          )}
          {tab === "带团笔记" &&
            (n ? (
              <ModuleNotes notebook={n} title={m.title} />
            ) : (
              <p>导入本团后即可保存笔记。</p>
            ))}
        </main>
      </div>
    </>
  );
}
