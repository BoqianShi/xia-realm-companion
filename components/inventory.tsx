"use client";
import { buildSchema } from "@/lib/validation";
import { useState } from "react";
import { Backpack, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addPossession,
  catalog,
  equipPossession,
  getEntry,
  inventoryCategory,
  inventoryIssues,
  inventoryName,
  isConsumable,
  ownedItems,
} from "@/lib/catalog";
import type { Build, Character, InventoryItem } from "@/lib/types";
import { EquipmentSummary } from "./reference-card";
import { useApp } from "./app-context";
import { Choice, NumberField } from "./common";

const possessionStatus = (b: Build, item: InventoryItem) => {
  const e = getEntry(item.id);
  return e?.slot === "武器"
    ? b.activeWeapon === item.id
      ? "持握中"
      : "备用武器"
    : b.equipment.includes(item.id)
      ? inventoryCategory(e) === "防具与饰物"
        ? "已穿戴"
        : "随身效果已启用"
      : inventoryCategory(e);
};

export function InventoryList({ build }: { build: Build }) {
  const a = useApp();
  const items = ownedItems(build);
  return (
    <div className="inventory-list">
      {items.length ? (
        items.map((item) => {
          const e = getEntry(item.id);
          return (
            <div className="inventory-read-row" key={item.id}>
              <div>
                {e ? (
                  <button
                    className="text-button"
                    onClick={() => a.setDetail(e)}
                  >
                    {inventoryName(item)}
                  </button>
                ) : (
                  <b>{inventoryName(item)}</b>
                )}
                {e && <EquipmentSummary entry={e} />}
                <small>
                  {possessionStatus(build, item)}
                  {item.note && ` · ${item.note}`}
                </small>
              </div>
              <b>×{item.quantity}</b>
            </div>
          );
        })
      ) : (
        <p className="muted">行囊里还没有记录物品。</p>
      )}
    </div>
  );
}

export function InventoryEditor({
  build: b,
  onChange,
  allowEquip = false,
}: {
  build: Build;
  onChange: (build: Build) => void;
  allowEquip?: boolean;
}) {
  const a = useApp();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState(allowEquip ? "武器" : "道具");
  const [limit, setLimit] = useState(12);
  const [customName, setCustomName] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const items = ownedItems(b);
  const update = (list: InventoryItem[]) => onChange({ ...b, inventory: list });
  const found = catalog.filter(
    (e) =>
      e.kind === "equipment" &&
      (!query || e.name.includes(query)) &&
      (category === "全部" || category === "道具"
        ? ["全部"].includes(category) ||
          ["药物与消耗品", "工具与其他道具"].includes(inventoryCategory(e))
        : inventoryCategory(e) === category),
  );
  const changeQuantity = (id: string, quantity: number) =>
    update(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(100000, Math.floor(quantity || 1)),
              ),
            }
          : item,
      ),
    );
  return (
    <div className="inventory-editor">
      <p className="muted">
        行囊记录你拥有的物品和数量。
        {allowEquip
          ? "只有标记为已装备或启用的物品参与属性计算；换下的装备会留在行囊。"
          : "穿戴和持握在角色构筑中调整。"}
        药物先记数量，实际使用的效果由 DM 结算。
      </p>
      <button
        className="button"
        aria-expanded={adding}
        onClick={() => setAdding((v) => !v)}
      >
        <Plus size={16} />
        {adding ? "收起添加物品" : "添加道具 / 装备"}
      </button>
      {adding && (
        <section className="inventory-add-panel">
          {" "}
          <h3>从资料库添加物品</h3>
          <div className="form-grid">
            <label className="field">
              <span>搜索物品</span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(12);
                }}
                placeholder="药丸、工具、武器、饰物…"
              />
            </label>
            <Choice
              label="物品分类"
              value={category}
              onChange={(v) => {
                setCategory(v);
                setLimit(12);
              }}
              options={[
                "道具",
                "武器",
                "防具与饰物",
                "药物与消耗品",
                "工具与其他道具",
                "全部",
              ].map((value) => ({
                value,
                label: value === "道具" ? "日常道具与消耗品" : value,
              }))}
            />
          </div>
          <p className="muted">
            找到 {found.length} 项 · 添加只记入行囊，不自动购买或扣钱。
          </p>
          <div className="picker-list short">
            {found.slice(0, limit).map((e) => (
              <div className="picker-row" key={e.id}>
                <button onClick={() => a.setDetail(e)}>
                  <b>{e.name}</b>
                  <EquipmentSummary entry={e} />
                </button>
                <button
                  className="button"
                  aria-label={`放入行囊：${e.name}`}
                  onClick={() => onChange(addPossession(b, e))}
                >
                  <Plus size={15} />
                  放入
                </button>
              </div>
            ))}
          </div>
          {found.length > limit && (
            <button
              className="button full-width"
              onClick={() => setLimit((n) => n + 12)}
            >
              显示更多物品
            </button>
          )}
          {!found.length && (
            <p className="muted">
              没有找到。可以换一个名称，或把它记为自定义物品。
            </p>
          )}
          <details className="disclosure">
            <summary>添加自定义物品</summary>
            <p className="muted">
              用于战利品、任务物品和资料库尚未收录的道具，不自动附加属性。
            </p>
            <div className="form-grid">
              <label className="field">
                <span>自定义物品名称</span>
                <input
                  maxLength={80}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="例如：书院密信"
                />
              </label>
              <NumberField
                label="自定义物品数量"
                value={customQuantity}
                min={1}
                onChange={(v) =>
                  setCustomQuantity(
                    Math.max(1, Math.min(100000, Math.floor(v || 1))),
                  )
                }
              />
            </div>
            <button
              className="button"
              disabled={!customName.trim()}
              onClick={() => {
                update([
                  ...items,
                  {
                    id: "custom-" + crypto.randomUUID(),
                    name: customName.trim(),
                    quantity: customQuantity,
                  },
                ]);
                setCustomName("");
                setCustomQuantity(1);
              }}
            >
              记入行囊
            </button>
          </details>
        </section>
      )}
      <div className="inventory-list" aria-label="已持有物品">
        {!items.length && (
          <div className="inset">
            尚未记录物品。点上方「添加道具 /
            装备」，从资料库挑选或记一件自定义物品。
          </div>
        )}
        {items.map((item) => {
          const e = getEntry(item.id);
          const equipped = b.equipment.includes(item.id);
          return (
            <article className="inventory-item" key={item.id}>
              <div className="inventory-item-title">
                <div>
                  {e ? (
                    <button
                      className="text-button"
                      onClick={() => a.setDetail(e)}
                    >
                      {inventoryName(item)}
                    </button>
                  ) : (
                    <b>{inventoryName(item)}</b>
                  )}
                  <small>{possessionStatus(b, item)}</small>
                </div>
                <label className="inventory-quantity">
                  <span>数量</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`${inventoryName(item)}数量`}
                    min={1}
                    max={100000}
                    value={item.quantity}
                    onChange={(ev) =>
                      changeQuantity(item.id, Number(ev.target.value))
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  disabled={equipped}
                  title={equipped ? "请先在角色构筑中卸下" : "移出行囊"}
                  aria-label={`移出行囊：${inventoryName(item)}`}
                  onClick={() => update(items.filter((x) => x.id !== item.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {e && <EquipmentSummary entry={e} />}
              <div className="inventory-item-controls">
                {allowEquip && e && (equipped || !isConsumable(e)) && (
                  <button
                    className={"button " + (equipped ? "active-choice" : "")}
                    onClick={() =>
                      onChange(
                        equipped
                          ? {
                              ...b,
                              inventory: items,
                              equipment: b.equipment.filter(
                                (id) => id !== item.id,
                              ),
                              activeWeapon:
                                b.activeWeapon === item.id
                                  ? ""
                                  : b.activeWeapon,
                            }
                          : equipPossession(b, item.id),
                      )
                    }
                  >
                    {equipped
                      ? "卸下 / 停用"
                      : e.slot === "武器"
                        ? "持握"
                        : inventoryCategory(e) === "防具与饰物"
                          ? "穿戴"
                          : "启用随身效果"}
                  </button>
                )}
              </div>
              <details className="inventory-note">
                <summary>
                  {item.note ? `备注：${item.note}` : "添加备注"}
                </summary>
                <label className="field">
                  <span>物品备注</span>
                  <input
                    aria-label={`${inventoryName(item)}备注`}
                    placeholder="用途、使用情况、获得来源…"
                    maxLength={500}
                    value={item.note ?? ""}
                    onChange={(ev) =>
                      update(
                        items.map((x) =>
                          x.id === item.id
                            ? { ...x, note: ev.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function CharacterInventory({
  character: ch,
  label,
}: {
  character: Character;
  label?: string;
}) {
  const a = useApp();
  const [editing, setEditing] = useState<{
    build: Build;
    revision: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const draftKey = "xia-inventory-draft:" + ch.id;
  const saveDraft = (next: { build: Build; revision: number }) => {
    setEditing(next);
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      a.setError("设备空间不足，行囊输入暂时只保存在当前页面。");
    }
  };
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  };
  const latest = a.campaign?.characters.find((x) => x.id === ch.id) ?? ch;
  const conflict = !!editing && latest.revision !== editing.revision;
  const issues = editing ? inventoryIssues(editing.build) : [];
  const close = () => setEditing(null);
  return (
    <>
      <button
        className="button"
        onClick={() => {
          a.setError("");
          let restored = false;
          try {
            const raw = localStorage.getItem(draftKey);
            if (raw) {
              const data = JSON.parse(raw);
              const parsed = buildSchema.safeParse(data.build);
              if (parsed.success && Number.isInteger(data.revision)) {
                setEditing({ build: parsed.data, revision: data.revision });
                restored = true;
                a.setNotice("已恢复本机行囊草稿；请核对最新存档后保存。");
              }
            }
          } catch {
            a.setError("本机行囊草稿无法读取。");
          }
          if (!restored)
            setEditing({
              build: structuredClone(ch.build),
              revision: ch.revision,
            });
        }}
      >
        <Backpack size={16} />
        {label ?? `行囊 · ${ownedItems(ch.build).length} 种`}
      </button>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v && !saving) close();
        }}
      >
        <DialogContent className="wide-dialog inventory-dialog">
          <DialogTitle>{ch.build.name}的行囊</DialogTitle>
          <DialogDescription>
            查看物品、调整数量和备注。输入保留为本机草稿，保存后全团可见并可撤销。
          </DialogDescription>
          {editing && (
            <>
              {a.error && (
                <p className="error-box" role="alert">
                  {a.error}
                </p>
              )}
              {conflict && (
                <div className="conflict-panel" role="alert">
                  <b>这张角色卡已更新</b>
                  <p>为避免覆盖新的数量，请载入最新行囊后重新调整。</p>
                  <button
                    className="button"
                    onClick={() => {
                      a.setError("");
                      saveDraft({
                        build: structuredClone(latest.build),
                        revision: latest.revision,
                      });
                    }}
                  >
                    载入最新行囊
                  </button>
                </div>
              )}
              <InventoryEditor
                build={editing.build}
                onChange={(build) => saveDraft({ ...editing, build })}
              />
              {issues.map((x) => (
                <p className="error-box" key={x}>
                  {x}
                </p>
              ))}
              <div className="inventory-save">
                <button className="button" disabled={saving} onClick={close}>
                  暂存关闭
                </button>
                <button
                  className="button subtle"
                  disabled={saving}
                  onClick={() => {
                    clearDraft();
                    close();
                  }}
                >
                  放弃草稿
                </button>
                <button
                  className="button primary"
                  disabled={
                    conflict || saving || a.busy || !a.online || !!issues.length
                  }
                  onClick={async () => {
                    setSaving(true);
                    try {
                      if (
                        await a.mutate("saveInventory", {
                          id: ch.id,
                          revision: editing.revision,
                          inventory: ownedItems(editing.build),
                        })
                      ) {
                        clearDraft();
                        close();
                      }
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "保存中…" : !a.online ? "联网后保存" : "保存行囊"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
