"use client";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { useApp } from "./app-context";
import { useHost, useHostDraft, DraftConflict } from "./host-shared";
import {
  entityKey,
  contextHits,
  resolveEntity,
  proseEntities,
  type ContextHit,
} from "@/lib/context-index";
import { encounterNpc, adventureEncounters } from "@/lib/adventure-encounters";
import { getEntry, sourceLabel } from "@/lib/catalog";
import { cleanRuleText } from "@/lib/reference-presentation";
import { modules } from "@/lib/modules";
import { emptyBuild } from "@/lib/rules";
import type { EntityRef } from "@/lib/hosting-schema";
import type { ModuleContent } from "@/lib/module-types";
import { MoveReference } from "./reference-card";
export function EntityCard({
  target,
  close,
}: {
  target: EntityRef | null;
  close: () => void;
}) {
  const a = useApp(),
    { h, send, disabled } = useHost();
  if (!target) return null;
  const hit = resolveEntity(target, a.campaign),
    rule = target.kind === "rule" ? getEntry(target.id) : null,
    npc =
      target.kind === "npc"
        ? encounterNpc(target.moduleId ?? "", target.id)
        : null;
  const related =
    target.kind === "npc"
      ? adventureEncounters.filter(
          (e) =>
            e.moduleId === target.moduleId &&
            e.cast.some((c) => c.npcId === target.id),
        )
      : [];
  return (
    <Sheet open onOpenChange={(v) => !v && close()}>
      <SheetContent className="context-sheet">
        <SheetTitle>{hit?.name ?? "资料暂缺"}</SheetTitle>
        <SheetDescription>{hit?.group ?? "原引用已保留"}</SheetDescription>
        {a.dm && (
          <button
            className="button"
            disabled={disabled}
            onClick={() => send({ kind: "pin", value: target })}
          >
            {h.pins?.some((p) => entityKey(p) === entityKey(target))
              ? "取消固定"
              : "固定到主持台"}
          </button>
        )}
        {rule && ["move", "special"].includes(rule.kind) && rule.formula ? (
          <MoveReference
            build={a.character?.build ?? emptyBuild()}
            id={rule.id}
            level={
              a.character?.build.moves.find((m) => m.id === rule.id)?.level ?? 1
            }
            rules={a.campaign?.rules}
          />
        ) : npc ? (
          <>
            <p>{npc.description}</p>
            <dl className="npc-fields">
              {npc.fields.map((f, i) => (
                <div key={i}>
                  <dt>{f.label}</dt>
                  <dd>{f.value || "原文未列"}</dd>
                </div>
              ))}
            </dl>
            {npc.moves.map((m, i) => (
              <section className="paper panel" key={i}>
                <h3>
                  {m.name} · {m.type}
                </h3>
                <p>
                  {m.resultLabel ?? "伤害"} {m.damage || "见效果"} · 消耗{" "}
                  {m.cost} · 距离 {m.distance}
                </p>
                <p>{m.effect}</p>
              </section>
            ))}
            <small>{npc.source}</small>
            {related.map((e) => (
              <p key={e.id}>
                相关遭遇：{e.title} · {e.trigger}
              </p>
            ))}
          </>
        ) : (
          <div>
            <p className="rule-text">
              {rule
                ? cleanRuleText(rule.text)
                : (hit?.text ?? "原资料暂不可用。")}
            </p>
            {rule && <small>{sourceLabel(rule)}</small>}
          </div>
        )}
        <LinkedNotes refs={[target]} />
      </SheetContent>
    </Sheet>
  );
}
export function LinkedText({
  text,
  moduleId,
}: {
  text: string;
  moduleId: string;
}) {
  const [target, setTarget] = useState<EntityRef | null>(null),
    found = useMemo(() => proseEntities(text, moduleId), [text, moduleId]);
  const parts: React.ReactNode[] = [];
  let at = 0;
  while (at < text.length) {
    let pos = text.length,
      hit: ContextHit | undefined;
    for (const h of found) {
      const p = text.indexOf(h.name, at);
      if (p >= 0 && p < pos) {
        pos = p;
        hit = h;
      }
    }
    if (!hit) {
      parts.push(text.slice(at));
      break;
    }
    parts.push(text.slice(at, pos));
    const ref = hit.ref;
    parts.push(
      <button
        key={pos}
        className="inline-reference"
        onClick={() => setTarget(ref)}
      >
        {hit.name}
      </button>,
    );
    at = pos + hit.name.length;
  }
  return (
    <>
      {parts}
      <EntityCard target={target} close={() => setTarget(null)} />
    </>
  );
}
export function LinkedNotes({ refs = [] }: { refs?: EntityRef[] }) {
  const { a, h, send, disabled } = useHost(),
    sessionId = h.activeSessionId ?? "legacy-session",
    key = "xia-linked-note:" + sessionId + refs.map(entityKey).join(","),
    d = useHostDraft(
      key,
      { id: "", text: "", refs, unresolved: false },
      h.revision,
    );
  const notes = (h.journal ?? []).filter((n) =>
    refs.length
      ? n.refs.some((r) => refs.some((x) => entityKey(x) === entityKey(r)))
      : n.sessionId === sessionId,
  );
  const [linkQuery, setLinkQuery] = useState("");
  const hits = linkQuery
    ? contextHits(a.campaign)
        .filter((x) => x.name.includes(linkQuery))
        .slice(0, 12)
    : [];
  return (
    <section className="linked-notes">
      <h3>关联速记</h3>
      {notes.map((n) => (
        <article key={n.id}>
          <small>
            {n.at} ·{" "}
            {h.sessions?.find((s) => s.id === n.sessionId)?.title ?? "本次跑团"}
            {n.unresolved ? " · 待解决" : ""}
          </small>
          <p>{n.text}</p>
          {a.dm && (
            <button
              className="text-button"
              onClick={() => {
                d.reset(
                  {
                    id: n.id,
                    text: n.text,
                    refs: n.refs,
                    unresolved: n.unresolved,
                  },
                  h.revision,
                  true,
                );
              }}
            >
              编辑／标记解决
            </button>
          )}
          {n.refs.map((r) => (
            <small key={entityKey(r)}>
              {resolveEntity(r, a.campaign)?.name} ·{" "}
            </small>
          ))}
        </article>
      ))}
      {a.dm && (
        <>
          <textarea
            aria-label="关联速记"
            placeholder="记录人物、线索或待解决问题"
            value={d.value.text}
            onChange={(e) => d.setValue({ ...d.value, text: e.target.value })}
          />
          <input
            aria-label="关联人物或规则"
            placeholder="搜索要关联的人物、场景、规则"
            value={linkQuery}
            onChange={(e) => setLinkQuery(e.target.value)}
          />
          {hits.map((x) => (
            <button
              className="text-button"
              key={entityKey(x.ref)}
              onClick={() => {
                d.setValue({
                  ...d.value,
                  refs: [
                    ...d.value.refs.filter(
                      (r) => entityKey(r) !== entityKey(x.ref),
                    ),
                    x.ref,
                  ],
                });
                setLinkQuery("");
              }}
            >
              关联 {x.name} · {x.group}
            </button>
          ))}
          <p>
            {d.value.refs
              .map((r) => resolveEntity(r, a.campaign)?.name)
              .join("、")}
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={d.value.unresolved}
              onChange={(e) =>
                d.setValue({ ...d.value, unresolved: e.target.checked })
              }
            />
            待解决事项
          </label>
          <DraftConflict conflict={d.conflict} rebase={d.rebase} />
          <button
            className="button"
            disabled={disabled || d.conflict || !d.value.text.trim()}
            onClick={async () => {
              if (
                await send(
                  {
                    kind: "journal",
                    value: {
                      ...d.value,
                      id: d.value.id || crypto.randomUUID(),
                      sessionId: d.value.id
                        ? (notes.find((n) => n.id === d.value.id)?.sessionId ??
                          sessionId)
                        : sessionId,
                      at: new Date().toISOString(),
                    },
                  },
                  d.base,
                )
              ) {
                d.clear();
                d.reset(
                  { id: "", text: "", refs, unresolved: false },
                  h.revision + 1,
                );
              }
            }}
          >
            {d.value.id ? "保存修改" : "保存速记"}
          </button>
        </>
      )}
    </section>
  );
}
export function ContextSearch() {
  const { a } = useHost(),
    [q, setQ] = useState(""),
    [target, setTarget] = useState<EntityRef | null>(null),
    [books, setBooks] = useState<ModuleContent[]>([]),
    [failed, setFailed] = useState(false);
  const searching = !!q.trim();
  useEffect(() => {
    if (!searching || books.length) return;
    let live = true;
    Promise.allSettled(
      modules.map((m) =>
        fetch(m.contentUrl).then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        }),
      ),
    ).then((r) => {
      if (!live) return;
      setBooks(
        r
          .filter((x) => x.status === "fulfilled")
          .map((x) => (x as PromiseFulfilledResult<ModuleContent>).value),
      );
      setFailed(r.some((x) => x.status === "rejected"));
    });
    return () => {
      live = false;
    };
  }, [searching, books.length]);
  const needle = q.trim(),
    hits = needle
      ? contextHits(a.campaign).filter(
          (h) => h.name.includes(needle) || h.text.includes(needle),
        )
      : [];
  const groups = [...new Set(hits.map((h) => h.group))];
  return (
    <section className="paper panel">
      <h2>全团查询</h2>
      <input
        aria-label="全团查询"
        placeholder="人物、功法、模组原文或笔记"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {failed && <p>部分模组暂未载入，其他结果仍可查询。</p>}
      {groups.map((g) => (
        <details key={g} open={groups.length < 5}>
          <summary>
            {g} · {hits.filter((h) => h.group === g).length}
          </summary>
          {hits
            .filter((h) => h.group === g)
            .slice(0, 30)
            .map((h) => (
              <button
                className="context-result"
                key={entityKey(h.ref)}
                onClick={() => setTarget(h.ref)}
              >
                <b>{h.name}</b>
                <small>{h.text.replace(/\n/g, " ").slice(0, 90)}</small>
              </button>
            ))}
        </details>
      ))}
      {needle &&
        books.map((m) => {
          const pages = m.pages.filter((p) => p.text.includes(needle));
          return (
            !!pages.length && (
              <details key={m.id}>
                <summary>
                  {m.title} · 正文 {pages.length} 页
                </summary>
                {pages.map((p) => (
                  <a
                    className="context-result"
                    key={p.number}
                    href={`/adventures/${m.id}?page=${p.number}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    第 {p.printed ?? p.number} 页 ·{" "}
                    {p.text.slice(
                      Math.max(0, p.text.indexOf(needle) - 25),
                      p.text.indexOf(needle) + 90,
                    )}
                  </a>
                ))}
              </details>
            )
          );
        })}
      {needle && (
        <details open>
          <summary>本团笔记</summary>
          {(a.campaign?.hosting?.sessions ?? [a.campaign?.hosting?.session])
            .filter(Boolean)
            .filter((s) =>
              [s!.title, s!.outline, s!.notes, s!.recap]
                .join(" ")
                .includes(needle),
            )
            .map((s, i) => (
              <p key={"session" + i}>
                <b>
                  {s!.title} · {s!.date}
                </b>
                <br />
                {[s!.outline, s!.notes, s!.recap]
                  .filter((t) => t.includes(needle))
                  .join(" · ")}
              </p>
            ))}
          {(a.campaign?.hosting?.journal ?? [])
            .filter((n) => n.text.includes(needle))
            .map((n) => (
              <p key={n.id}>{n.text}</p>
            ))}
          {a.campaign?.characters.flatMap((ch) =>
            (ch.table?.notes ?? [])
              .filter((n) => n.text.includes(needle))
              .map((n) => (
                <p key={ch.id + n.id}>
                  {ch.build.name} · {n.text}
                </p>
              )),
          )}
        </details>
      )}
      <EntityCard target={target} close={() => setTarget(null)} />
    </section>
  );
}
