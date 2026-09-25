"use client";
import { NumberHelp } from "./number-help";
import { explainSkill, explainStat } from "@/lib/explanations";
import { useEffect, useState } from "react";
import { Star, Plus, Undo2 } from "lucide-react";
import { tableOperationSchema } from "@/lib/validation";
import type { Character, Condition } from "@/lib/types";
import { catalog, effectiveMoves, getEntry, ownedItems, inventoryName } from "@/lib/catalog";
import { calculateCharacter, calculateMove } from "@/lib/rules";
import {
  tableData,
  resourceNames,
  resourceChange,
  buildResourceChanges,
  loadoutBuild,
  skillReference,
  type TableOperation,
} from "@/lib/tabletop";
import { useApp } from "./app-context";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { EquipmentSummary } from "./reference-card";
import { CharacterInventory } from "./inventory";
import { effectDescription, stanceReference } from "@/lib/table-effects";
export type OpenTable = (op: TableOperation) => void;
type Draft = { revision: number; operation: TableOperation };
export function useTableEditor(ch: Character) {
  const a = useApp();
  const key = "xia-table-draft:" + ch.id;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const d = JSON.parse(raw);
        const op = structuredClone(d?.operation);
        // Empty names and notes are normal unfinished input; validate their shape too.
        if (op?.kind === "note" && op.text === "") op.text = "未填写";
        if (
          ["condition", "counter"].includes(op?.kind) &&
          op.value?.name === ""
        )
          op.value.name = "未填写";
        if (
          Number.isInteger(d?.revision) &&
          tableOperationSchema.safeParse(op).success
        )
          setDraft(d);
        else setStorageError("本机草稿格式不完整，请重新记录。");
      } catch {
        setStorageError("未能读取本机桌边草稿。");
      }
    });
    return () => {
      live = false;
    };
  }, [key]);
  const persist = (value: Draft | null) => {
    setDraft(value);
    try {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    } catch {
      setStorageError("设备空间不足，输入暂时只保存在当前页面。");
    }
  };
  const start: OpenTable = (operation) => {
    if (draft) {
      setOpen(true);
      a.setNotice("已有未保存输入，请先保存或放弃本次草稿，再记录其他项目。");
      return;
    }
    persist({ revision: ch.revision, operation });
    setAck(false);
    setOpen(true);
  };
  const direct = async (operation: TableOperation) =>
    a.mutate("tableEdit", { id: ch.id, revision: ch.revision, operation });
  const save = async () => {
    if (!draft) return;
    const ok = await a.mutate("tableEdit", {
      id: ch.id,
      revision: draft.revision,
      operation: draft.operation,
      acknowledged: ack,
    });
    if (ok) {
      persist(null);
      setOpen(false);
    }
  };
  const conflict = !!draft && draft.revision !== ch.revision;
  let consequences: string[] = [];
  try {
    if (draft?.operation.kind === "loadout")
      consequences = buildResourceChanges(
        ch,
        loadoutBuild(ch, draft.operation.field, draft.operation.value),
      );
  } catch (e) {
    consequences = [e instanceof Error ? e.message : "请选择可用装备"];
  }
  const editor = (
    <>
      {storageError && <p className="error-box">{storageError}</p>}
      {draft && !open && (
        <div className="draft-banner">
          <span>本机桌边草稿尚未保存</span>
          <button className="text-button" onClick={() => setOpen(true)}>
            继续记录
          </button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="table-edit-dialog">
          <DialogTitle>记录 · {ch.build.name}</DialogTitle>
          <DialogDescription>
            只修改下面这一项。保存后全团可见；状态与计数不自动结算。
          </DialogDescription>
          {draft && (
            <TableEditForm
              ch={ch}
              op={draft.operation}
              onChange={(operation) => {
                persist({ ...draft, operation });
                setAck(false);
              }}
            />
          )}
          {conflict && (
            <div className="warning-box">
              <b>角色已有新记录，输入已保留</b>
              <p>请核对页面里的最新数值，再继续本次修改。</p>
              <button
                className="button"
                onClick={() => {
                  if (draft) persist({ ...draft, revision: ch.revision });
                }}
              >
                已核对，按最新版本继续
              </button>
            </div>
          )}
          {!!consequences.length && (
            <div className="warning-box">
              {consequences.map((t) => (
                <p key={t}>{t}</p>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                已核对以上变化
              </label>
            </div>
          )}
          {!a.online && (
            <p className="warning-box">
              当前离线，输入保存在本机。联网后核对最新版本再保存。
            </p>
          )}
          {a.error && (
            <p className="error-box" role="alert">
              {a.error}
            </p>
          )}
          <div className="button-group">
            <button className="button" onClick={() => setOpen(false)}>
              暂存关闭
            </button>
            <button
              className="button subtle"
              onClick={() => {
                persist(null);
                setOpen(false);
              }}
            >
              放弃本次输入
            </button>
            <button
              className="button primary"
              disabled={
                !draft ||
                !a.online ||
                a.busy ||
                conflict ||
                (consequences.length > 0 && !ack)
              }
              onClick={save}
            >
              确认保存
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
  return { start, direct, editor };
}
function TableEditForm({
  ch,
  op,
  onChange,
}: {
  ch: Character;
  op: TableOperation;
  onChange: (op: TableOperation) => void;
}) {
  if (op.kind === "resource") {
    const r = resourceChange(ch, op);
    return (
      <div className="table-form">
        <label>
          {resourceNames[op.field]}修改方式
          <select
            value={op.mode}
            onChange={(e) =>
              onChange({ ...op, mode: e.target.value as typeof op.mode })
            }
          >
            <option value="subtract">减少</option>
            <option value="add">增加</option>
            <option value="set">设为</option>
          </select>
        </label>
        <label>
          数值
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={op.value}
            onChange={(e) =>
              onChange({
                ...op,
                value: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
          />
        </label>
        <p className="change-preview">
          {resourceNames[op.field]}{" "}
          <b>
            {r.before} → {r.after}
          </b>
          {op.field === "silver" ? " 两" : ` / ${r.max}`}
        </p>
        {r.clamped && <p>结果已限制在 0 至 {r.max}。</p>}
      </div>
    );
  }
  if (op.kind === "stance")
    return (
      <div className="table-form"><label className="field">
        当前架招
        <select
          value={op.value}
          onChange={(e) => onChange({ ...op, value: e.target.value })}
        >
          <option value="">未开启</option>
          {effectiveMoves(ch.build)
            .filter((x) => getEntry(x.id)?.moveType === "架招")
            .map((x) => (
              <option key={x.id} value={x.id}>
                {getEntry(x.id)?.name} · 基础格挡{" "}
                {calculateMove(ch.build, x.id, x.level).block}
              </option>
            ))}
        </select>
      </label>
      {!effectiveMoves(ch.build).some(x => getEntry(x.id)?.moveType === "架招") && <p>还没有学会架招。请到「武学」学习架招后再记录。</p>}
      <StanceEffect ch={ch} id={op.value} expanded />
      <small>保存只记录当前架招，不自动扣内力。开启所需动作、消耗与条件由桌上处理。</small>
      </div>
    );
  if (op.kind === "condition")
    return (
      <div className="table-form">
        <label>
          状态名称
          <input
            list="table-status-list"
            maxLength={40}
            value={op.value.name}
            onChange={(e) =>
              onChange({ ...op, value: { ...op.value, name: e.target.value } })
            }
          />
          <datalist id="table-status-list">
            {catalog
              .filter((x) => x.kind === "status")
              .map((x) => (
                <option key={x.id} value={x.name} />
              ))}
          </datalist>
        </label>
        <label>
          效果说明（全团和大屏可见）
          <textarea value={op.value.effect ?? ""} maxLength={1000}
            placeholder="自定义增益请写具体效果；标准状态留空时显示规则说明"
            onChange={(e) => onChange({ ...op, value: { ...op.value, effect: e.target.value } })} />
        </label>
        <label>
          层数（层数状态逐层记录；普通持续状态填 1）
          <input
            type="number"
            min="1"
            max="1000"
            value={op.value.stacks}
            onChange={(e) =>
              onChange({
                ...op,
                value: {
                  ...op.value,
                  stacks: Math.max(1, Number(e.target.value) || 1),
                },
              })
            }
          />
        </label>
        <label>
          持续回合（到计时参照者之后的第几个回合开始）
          <input
            type="number"
            min="1"
            value={op.value.remaining ?? ""}
            onChange={(e) =>
              onChange({
                ...op,
                value: {
                  ...op.value,
                  remaining: e.target.value
                    ? Math.max(1, Number(e.target.value) || 1)
                    : null,
                },
              })
            }
          />
        </label>
        <label>
          结束条件／备注（例如脱战、解除架招）
          <textarea
            value={op.value.note}
            maxLength={1000}
            onChange={(e) =>
              onChange({ ...op, value: { ...op.value, note: e.target.value } })
            }
          />
        </label>
        <label>
          计时参照者（状态产生时正在行动的人）
          <input
            value={op.value.anchor}
            maxLength={140}
            onChange={(e) =>
              onChange({
                ...op,
                value: { ...op.value, anchor: e.target.value },
              })
            }
          />
        </label>
        <p className="muted">
          层数类通常持续至脱战；持续回合类同名状态叠加时长。这里仅记录，不自动推进或结算。
        </p>
        <StatusRule name={op.value.name} effect={op.value.effect} />
      </div>
    );
  if (op.kind === "counter")
    return (
      <div className="table-form">
        <label>
          计数器名称
          <input
            maxLength={40}
            placeholder="例如：化劲、已用次数"
            value={op.value.name}
            onChange={(e) =>
              onChange({ ...op, value: { ...op.value, name: e.target.value } })
            }
          />
        </label>
        <label>效果说明（全团和大屏可见）
          <textarea value={op.value.effect ?? ""} maxLength={1000} placeholder="例如每消耗一层增加多少伤害"
            onChange={(e) => onChange({ ...op, value: { ...op.value, effect: e.target.value } })} />
        </label>
        <label>
          当前数值
          <input
            type="number"
            min="0"
            max="100000"
            value={op.value.value}
            onChange={(e) =>
              onChange({
                ...op,
                value: {
                  ...op.value,
                  value: Math.max(0, Number(e.target.value) || 0),
                },
              })
            }
          />
        </label>
        <label>
          结束条件／备注（例如脱战、解除架招）
          <input
            maxLength={500}
            value={op.value.note}
            onChange={(e) =>
              onChange({ ...op, value: { ...op.value, note: e.target.value } })
            }
          />
        </label>
      </div>
    );
  if (op.kind === "note")
    return (
      <label className="field">
        人物、地点、线索与约定
        <textarea
          rows={7}
          maxLength={4000}
          placeholder="写下刚发生的事…"
          value={op.text}
          onChange={(e) => onChange({ ...op, text: e.target.value })}
        />
        <small>保存后自动添加时间；队友也能查看。</small>
      </label>
    );
  if (op.kind === "item") {
    const item = ownedItems(ch.build).find((x) => x.id === op.id);
    return (
      <div className="table-form">
        <p>
          {item ? inventoryName(item) : "物品"}：{item?.quantity ?? 0} →{" "}
          {(item?.quantity ?? 0) + op.delta}
        </p>
        <label>
          数量变化
          <input
            type="number"
            value={op.delta}
            onChange={(e) =>
              onChange({
                ...op,
                delta: Math.floor(Number(e.target.value) || 0),
              })
            }
          />
        </label>
        {getEntry(op.id) && <EquipmentSummary entry={getEntry(op.id)!} />}
        <small>这里只记数量，不自动购买、扣钱或执行药效。</small>
      </div>
    );
  }
  if (op.kind === "loadout") {
    const inner = op.field === "activeInner";
    const ids = inner
      ? ch.build.inner.map((x) => x.id)
      : ownedItems(ch.build)
          .filter((x) => getEntry(x.id)?.slot === "武器")
          .map((x) => x.id);
    return (
      <label className="field">
        {inner ? "运行内功" : "持握武器"}
        <select
          value={op.value}
          onChange={(e) => onChange({ ...op, value: e.target.value })}
        >
          <option value="">{inner ? "未运行" : "徒手"}</option>
          {ids.map((id) => (
            <option key={id} value={id}>
              {getEntry(id)?.name}
            </option>
          ))}
        </select>
        {getEntry(op.value) && !inner && (
          <EquipmentSummary entry={getEntry(op.value)!} />
        )}
        <small>面板按新选择重算，当前气血和内力不会自动回满。</small>
        {inner && (
          <p className="inset">
            切换消耗主要或反应动作。原书：未受伤时保持满值，受伤时保留当前数值且不超过新上限；切换后怒气归零。请在桌上确认后手动记资源。
          </p>
        )}
      </label>
    );
  }
  return (
    <p>
      {op.kind === "removeCondition"
        ? "移除这条状态提醒？"
        : op.kind === "removeCounter"
          ? "移除这个计数器？"
          : "更新收藏"}
    </p>
  );
}
function StatusRule({ name, effect }: { name: string; effect?: string }) {
  const entry = effectDescription({ name, effect });
  return entry ? (
    <p className="inset">
      {entry.text}
      {entry.stageDependent && <small>这是规则原文；本次施展阶段请确认后填入效果说明。</small>}
    </p>
  ) : (
    <p className="muted">尚未填写效果说明；可在编辑中补充。</p>
  );
}

export function StanceEffect({ ch, id, expanded = false }: { ch: Character; id: string; expanded?: boolean }) {
  const a = useApp(), s = stanceReference(ch.build, id, a.campaign?.rules);
  return <div className="stance-effect">
    <div><strong>{s.name}</strong><span>基础格挡 <b>{s.block ?? "—"}</b></span></div>
    {s.summary && <p>{s.summary}</p>}
    {id && <details open={expanded || undefined}>
      <summary>完整效果与使用条件</summary>
      <small>{s.meta}</small>
      {s.details.map((line, i) => <p key={i}>{line}</p>)}
      {s.entryId && getEntry(s.entryId) && <button className="text-button" onClick={() => a.setDetail(getEntry(s.entryId)!)}>查看招式与计算 →</button>}
    </details>}
  </div>;
}

export function StanceControl({ ch, onEdit }: { ch: Character; onEdit: OpenTable }) {
  return <section className="stance-control" aria-label="当前架招">
    <div className="section-heading"><h3>当前架招</h3><button className="button" onClick={() => onEdit({ kind: "stance", value: ch.runtime.stance })}>{ch.runtime.stance ? "更换／解除架招" : "记录架招"}</button></div>
    <StanceEffect ch={ch} id={ch.runtime.stance} />
  </section>;
}
export function ResourceStrip({
  ch,
  onEdit,
}: {
  ch: Character;
  onEdit?: OpenTable;
}) {
  const c = calculateCharacter(ch.build);
  return (
    <div className="resource-strip">
      {(["hp", "mp", "rage", "shield"] as const).map((k) => (
        <div key={k} className={"resource-cell resource-" + k}>
          <div className="resource-label">
            <small>{resourceNames[k]}</small>
            <NumberHelp
              help={
                k === "hp" || k === "mp"
                  ? explainStat(c, k === "hp" ? "hpMax" : "mpMax")
                  : {
                      title: resourceNames[k],
                      formula:
                        k === "rage"
                          ? "手动记录，范围 0～10"
                          : "手动记录当前护体数值",
                      rows: [],
                      notes: [
                        "招式、状态不会自动增减这个数值；按桌上确认的效果记账。",
                        "点下方数字可以增加、减少或设置；保存后可在桌边记录撤销。",
                      ],
                    }
              }
            />
          </div>
          <button
            type="button"
            className="resource-edit"
            aria-label={`${resourceNames[k]} ${ch.runtime[k]}${k === "hp" ? ` / ${c.hpMax}` : k === "mp" ? ` / ${c.mpMax}` : ""}，手动记账`}
            disabled={!onEdit}
            onClick={() =>
              onEdit?.({
                kind: "resource",
                field: k,
                mode: "subtract",
                value: 0,
              })
            }
          >
            <b>{ch.runtime[k]}</b>
            {k === "hp" || k === "mp" ? (
              <em> / {k === "hp" ? c.hpMax : c.mpMax}</em>
            ) : k === "rage" ? (
              <em> / 10</em>
            ) : null}
          </button>
        </div>
      ))}
    </div>
  );
}
export function TableStates({
  ch,
  onEdit,
}: {
  ch: Character;
  onEdit?: OpenTable;
}) {
  const td = tableData(ch);
  return (
    <section className="paper table-states">
      <div className="section-heading"><h3>状态与增益</h3></div>
      <small>按效果手动记账；持续时间不会自动递减。</small>
      <div className="condition-chips">
        {ch.runtime.conditions.map((s) => (
          <article className="table-condition" key={s.id}>
            <strong>{s.name}{s.stacks > 1 ? ` ×${s.stacks}` : ""}</strong>
            <StatusRule name={s.name} effect={s.effect} />
            <small>{s.remaining === null ? "手动移除" : `${s.anchor || "待填参照者"} · 第${s.remaining}个回合开始结束`}</small>
            <details><summary>备注与管理</summary>
              {s.note && <p>{s.note}</p>}
              {onEdit && <div className="button-group">
                <button className="button" onClick={() => onEdit({ kind: "condition", value: s })}>编辑效果／层数</button>
                <button className="button subtle" onClick={() => onEdit({ kind: "removeCondition", id: s.id })}>移除</button>
              </div>}
            </details>
          </article>
        ))}
      </div>
      {onEdit && (
        <div className="button-group">
          <button
            className="button"
            onClick={() =>
              onEdit({
                kind: "condition",
                value: {
                  id: crypto.randomUUID(),
                  name: "",
                  stacks: 1,
                  remaining: null,
                  anchor: "",
                  note: "",
                } satisfies Condition,
              })
            }
          >
            <Plus size={15} />
            添加状态／增益
          </button>
          <button
            className="button"
            onClick={() =>
              onEdit({
                kind: "counter",
                value: {
                  id: crypto.randomUUID(),
                  name: "",
                  value: 0,
                  note: "",
                },
              })
            }
          >
            <Plus size={15} />
            计数器
          </button>
        </div>
      )}
      {td.counters.map((c) => (
        <div className="table-counter" key={c.id}>
          <div>
            <b>{c.name}</b>
            <StatusRule name={c.name} effect={c.effect} /><small>{c.note}</small>
          </div>
          <strong>{c.value}</strong>
          {onEdit && (
            <>
              <button
                className="button"
                onClick={() => onEdit({ kind: "counter", value: c })}
              >
                修改
              </button>
              <button
                className="text-button"
                aria-label={"移除计数器" + c.name}
                onClick={() => onEdit({ kind: "removeCounter", id: c.id })}
              >
                移除
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
export function SkillSheet({
  ch,
  pinnedOnly = false,
  onPin,
}: {
  ch: Character;
  pinnedOnly?: boolean;
  onPin?: (name: string) => void;
}) {
  const a = useApp();
  const [q, setQ] = useState("");
  const data = tableData(ch);
  const skills = catalog.filter(
    (e) =>
      e.kind === "skill" &&
      e.id === "skill-" + e.name &&
      (!pinnedOnly || data.pinnedSkills.includes(e.name)) &&
      (!q || e.name.includes(q) || e.grade.includes(q)),
  );
  return (
    <section className="skill-sheet">
      <h2>{pinnedOnly ? "常用检定" : "技能与技艺"}</h2>
      {!pinnedOnly && (
        <label className="field">
          搜索技能
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="洞察、书写、力量…"
          />
        </label>
      )}
      {!skills.length && (
        <p className="muted">
          {pinnedOnly ? "在技能页收藏常用检定，即可放在这里。" : "未找到技能。"}
        </p>
      )}
      <div className="skill-cards">
        {skills.map((e) => {
          const r = skillReference(ch, e.name);
          return (
            <article className="paper skill-card" key={e.id}>
              <div className="section-heading">
                <button className="text-button" onClick={() => a.setDetail(e)}>
                  <b>{e.name}</b>
                  <small>{e.grade}</small>
                </button>
                {onPin && (
                  <button
                    className="icon-button"
                    disabled={!a.online || a.busy}
                    aria-label={"收藏技能" + e.name}
                    aria-pressed={data.pinnedSkills.includes(e.name)}
                    onClick={() => onPin(e.name)}
                  >
                    <Star
                      size={17}
                      fill={
                        data.pinnedSkills.includes(e.name)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                )}
              </div>
              <p className="check-formula">
                D20{" "}
                <b>
                  <NumberHelp help={explainSkill(ch.build, e.name)}>
                    ＋{r.value}
                  </NumberHelp>
                </b>
              </p>
              <small>掷实体骰，加值后与难度比较。</small>
              {r.conditional.map((t, i) => (
                <p className="skill-condition" key={i}>
                  {t}
                </p>
              ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function TableInventory({
  ch,
  onEdit,
}: {
  ch: Character;
  onEdit?: OpenTable;
}) {
  const [q, setQ] = useState("");
  const a = useApp();
  return (
    <section>
      <div className="section-heading">
        <h2>行囊</h2>
        {onEdit && <CharacterInventory character={ch} label="添加／整理物品" />}
      </div>
      <div className="silver-line">
        <b>白银 {ch.build.silver} 两</b>
        {onEdit && (
          <button
            className="button"
            onClick={() =>
              onEdit({
                kind: "resource",
                field: "silver",
                mode: "subtract",
                value: 0,
              })
            }
          >
            记收支
          </button>
        )}
      </div>
      <label className="field">
        查找随身物品
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="药物、武器、任务物品…"
        />
      </label>
      {ownedItems(ch.build)
        .filter((i) => !q || inventoryName(i).includes(q))
        .map((i) => {
          const e = getEntry(i.id);
          return (
            <article className="paper table-item" key={i.id}>
              <div className="section-heading">
                <button
                  className="text-button"
                  onClick={() => e && a.setDetail(e)}
                >
                  <b>{inventoryName(i)}</b>
                </button>
                <strong>×{i.quantity}</strong>
              </div>
              {e && <EquipmentSummary entry={e} />}
              <p className="muted">
                {ch.build.activeWeapon === i.id
                  ? "持握中"
                  : e?.slot === "武器"
                    ? "备用武器"
                    : ch.build.equipment.includes(i.id)
                      ? "已装备／启用"
                      : "行囊物品"}
                {i.note ? " · " + i.note : ""}
              </p>
              {onEdit && (
                <div className="button-group">
                  <button
                    className="button"
                    onClick={() =>
                      onEdit({ kind: "item", id: i.id, delta: -1 })
                    }
                  >
                    数量 −1
                  </button>
                  <button
                    className="button"
                    onClick={() => onEdit({ kind: "item", id: i.id, delta: 1 })}
                  >
                    数量 +1
                  </button>
                  {e?.slot === "武器" && ch.build.activeWeapon !== i.id && (
                    <button
                      className="button"
                      onClick={() =>
                        onEdit({
                          kind: "loadout",
                          field: "activeWeapon",
                          value: i.id,
                        })
                      }
                    >
                      持握
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
    </section>
  );
}
export function TableNotes({
  ch,
  onEdit,
}: {
  ch: Character;
  onEdit?: OpenTable;
}) {
  return (
    <section>
      <div className="section-heading">
        <h2>笔记</h2>
        {onEdit && (
          <button
            className="button primary"
            onClick={() => onEdit({ kind: "note", text: "" })}
          >
            记一条
          </button>
        )}
      </div>
      <p className="muted">人物、地点、线索与约定，全团可见。</p>
      {ch.build.notes && (
        <article className="paper table-note">
          <small>人物背景与旧笔记</small>
          <p>{ch.build.notes}</p>
        </article>
      )}
      {tableData(ch).notes.map((n) => (
        <article className="paper table-note" key={n.id}>
          <time dateTime={n.at}>{new Date(n.at).toLocaleString("zh-CN")}</time>
          <p>{n.text}</p>
        </article>
      ))}
    </section>
  );
}
export function TableHistory({ ch }: { ch: Character }) {
  const a = useApp();
  const entries =
    a.campaign?.logs.filter((l) => l.table && l.before[ch.id]).slice(0, 12) ??
    [];
  return (
    <details className="paper table-history">
      <summary>最近的桌边记录 · {entries.length}</summary>
      {entries.map((l) => (
        <div className="history-row" key={l.id}>
          <small>
            {new Date(l.at).toLocaleString("zh-CN")} · {l.by}
          </small>
          <p>{l.details.join("；")}</p>
          {l.undone ? (
            <small>已撤销</small>
          ) : (
            <button
              className="button"
              disabled={
                !a.online || a.busy || l.afterRevisions[ch.id] !== ch.revision
              }
              onClick={() => a.mutate("tableUndo", { id: l.id })}
            >
              <Undo2 size={14} />
              撤销这条
            </button>
          )}
        </div>
      ))}
      <small>只能撤销尚未被后续修改覆盖的记录。</small>
    </details>
  );
}
