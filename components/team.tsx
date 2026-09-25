"use client";
import { DATA_REVISION } from "@/lib/catalog";
import { mergePortraits, portraitsSchema } from "@/lib/portraits";
import { ModuleShelf } from "./modules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { catalog, effectiveMoves, getEntry, ownedItems } from "@/lib/catalog";
import { calculateCharacter, calculateMove } from "@/lib/rules";
import type { Campaign, Rulings } from "@/lib/types";
import { RULES_VERSION } from "@/lib/types";
import { buildSchema, campaignSchema, characterSchema } from "@/lib/validation";
import { Download, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PartyDetails } from "./party-details";
import { useApp } from "./app-context";
import { Check, Choice, download, Empty } from "./common";
export function TeamView() {
  const a = useApp();
  const [viewing, setViewing] = useState("");
  const [restore, setRestore] = useState<Campaign | null>(null);
  const [restoreCheck, setRestoreCheck] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const c = a.campaign;

  if (!c) return <Empty title="正在读取队伍" />;
  const importFile = async (f: File) => {
    try {
      if (f.size > 8500000) throw new Error("存档文件超过 8 MB。");
      const data = JSON.parse(await f.text());
      if (data.rulesVersion !== RULES_VERSION)
        throw new Error("存档的规则版本与本应用不同，不能直接恢复。");
      if (data.format === "xia-build-v1") {
        const build = buildSchema.parse(data.build);
        a.setDraft({
          id: a.character?.id ?? crypto.randomUUID(),
          revision: a.character?.revision ?? 0,
          build,
          isNew: !a.character,
        });
        a.setBuilderOpen(true);
      } else if (data.format === "xia-character-v1") {
        if (!a.dm) throw new Error("恢复角色状态请先切换到团务管理。");
        const ch = characterSchema.parse(data.character);
        setRestore({
          ...structuredClone(c),
          portraits: mergePortraits(c.portraits, portraitsSchema.parse(data.portraits ?? {})),
          characters: [...c.characters.filter((x) => x.id !== ch.id), ch],
        });
        setRestoreCheck(false);
      } else if (data.format === "xia-campaign-v1") {
        if (!a.dm) throw new Error("恢复本团数据请先切换到团务管理。");
        setRestore(campaignSchema.parse(data.campaign));
        setRestoreCheck(false);
      } else throw new Error("不支持此文件格式。");
    } catch (e) {
      a.setError(e instanceof Error ? e.message : "无法读取存档。");
    }
  };
  return (
    <>
      <PartyDetails
        character={c.characters.find((x) => x.id === viewing) ?? null}
        onClose={() => setViewing("")}
      />
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {a.dm ? "团务管理" : "队伍总览"} ·{" "}
            {c.characters.filter((x) => x.build.kind === "pc").length} 位侠士
          </p>
          <h1>{c.name}</h1>
        </div>
        <div className="button-group">
          <button className="button" onClick={() => a.startDraft()}>
            <Plus size={17} />
            角色 / NPC
          </button>
          {!a.dm && (
            <button className="button primary" onClick={() => a.setDm(true)}>
              <ShieldCheck size={16} />
              进入团务管理
            </button>
          )}
        </div>
      </div>
      <p className="muted">
        队友的资源、属性、技能、武学、行囊与笔记全部互相可见。点开队友资料即可查看，当前操作角色不会改变。
      </p>
      {a.dm && <ModuleShelf />}
      {c.hosting?.session.recap && (
        <section className="paper panel">
          <div className="section-heading">
            <h2>跑团回顾 · {c.hosting.session.title}</h2>
            <small>{c.hosting.session.date}</small>
          </div>
          <p className="preserve">{c.hosting.session.recap}</p>
        </section>
      )}
      {a.dm && (
        <button className="button" onClick={() => a.setView("主持台")}>
          打开主持台 · 备团、场景与投屏 →
        </button>
      )}
      <div className="party-grid">
        {c.characters.map((ch) => {
          const s = calculateCharacter(ch.build);
          const stance = effectiveMoves(ch.build).find((m) => m.id === ch.runtime.stance);
          const block = stance
            ? calculateMove(ch.build, stance.id, stance.level, c.rules).block
            : s.block;
          return (
            <article className="paper party-card" key={ch.id}>
              <div className="section-heading">
                <div>
                  <small>
                    {ch.build.kind === "npc" ? "NPC" : ch.build.sect}
                  </small>
                  <h2>{ch.build.name}</h2>
                </div>
                <span className="avatar small">{ch.build.name[0]}</span>
              </div>
              <div className="data-grid">
                <div>
                  <span>气血</span>
                  <b>
                    {ch.runtime.hp} / {s.hpMax}
                  </b>
                </div>
                <div>
                  <span>内力</span>
                  <b>
                    {ch.runtime.mp} / {s.mpMax}
                  </b>
                </div>
                <div>
                  <span>移动</span>
                  <b>{s.speed} 米</b>
                </div>
                <div>
                  <span>{stance ? "架招基础格挡" : "未开架招格挡"}</span>
                  <b>{block}</b>
                </div>
              </div>
              <p className="party-summary">
                运行 {getEntry(ch.build.activeInner)?.name ?? "未选择内功"} ·{" "}
                {effectiveMoves(ch.build).length} 招 · 行囊 {ownedItems(ch.build).length}{" "}
                种
              </p>
              <div className="button-group">
                <button
                  className="text-button"
                  onClick={() => setViewing(ch.id)}
                >
                  查看属性、招式与行囊
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {a.dm && (
        <RulesPanel
          key={c.rules.rounding + c.rules.fixedDamage + c.rules.allowExpansion}
          rules={c.rules}
          name={c.name}
        />
      )}
      <section className="paper panel">
        <h2>构筑方案</h2>
        <p className="muted">全团共享方案；载入到草稿后可对比和继续修改。</p>
        <div className="scheme-list">
          {c.snapshots.map((s) => (
            <div className="reference-row" key={s.id}>
              <span>
                <strong>{s.name}</strong>
                <small>
                  {s.build.name} ·{" "}
                  {new Date(s.createdAt).toLocaleDateString("zh-CN")}
                </small>
              </span>
              <div className="button-group">
                <button
                  className="button"
                  onClick={() => {
                    const ch = c.characters.find((x) => x.id === s.characterId);
                    a.setDraft({
                      id: ch?.id ?? crypto.randomUUID(),
                      revision: ch?.revision ?? 0,
                      build: structuredClone(s.build),
                      isNew: !ch,
                    });
                    a.setBuilderOpen(true);
                  }}
                >
                  载入试配
                </button>
                <button
                  className="icon-button"
                  aria-label={"删除方案" + s.name}
                  onClick={() => a.mutate("deleteSnapshot", { id: s.id })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {!c.snapshots.length && (
          <p className="muted">在角色构筑的「核对结果」中保存方案。</p>
        )}
      </section>
      <section className="paper panel">
        <h2>带走你的江湖</h2>
        <p className="muted">
          导出包含角色、行囊、构筑方案、已导入模组的版本、进度与笔记。设备离线时，也可以把最近同步到的存档导出。
        </p>
        <div className="button-group">
          <button
            className="button"
            onClick={() =>
              download(c.name + "-全团存档.json", {
                format: "xia-campaign-v1",
                rulesVersion: RULES_VERSION,
                dataRevision: DATA_REVISION,
                exportedAt: new Date().toISOString(),
                campaign: c,
              })
            }
          >
            <Download size={17} />
            导出本团
          </button>
          <button className="button" onClick={() => file.current?.click()}>
            <Upload size={17} />
            导入角色 / 草稿 / 本团
          </button>
          <input
            ref={file}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>
      <Dialog
        open={!!restore}
        onOpenChange={(v) => {
          if (!v) setRestore(null);
        }}
      >
        <DialogContent>
          <DialogTitle>恢复存档</DialogTitle>
          <DialogDescription>
            恢复会替换当前本团数据。请先导出当前存档，以便需要时恢复。
          </DialogDescription>
          <p>
            将恢复 {restore?.characters.length} 位角色、
            {restore?.snapshots.length} 个方案、{restore?.logs.length} 条记录。
          </p>
          <Check
            label="已核对文件，并愿意替换当前本团存档"
            checked={restoreCheck}
            onChange={setRestoreCheck}
          />
          <button
            className="button primary"
            disabled={!restoreCheck || a.busy || !a.online}
            onClick={async () => {
              if (
                await a.mutate("restore", {
                  campaign: restore,
                  acknowledged: true,
                })
              )
                setRestore(null);
            }}
          >
            确认恢复
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function RulesPanel({ rules, name }: { rules: Rulings; name: string }) {
  const a = useApp();
  const [r, setR] = useState(rules);
  const [n, setN] = useState(name);
  const [q, setQ] = useState("");
  const found = catalog
    .filter(
      (e) =>
        ["inner", "routine", "special"].includes(e.kind) &&
        q &&
        e.name.includes(q),
    )
    .slice(0, 12);
  return (
    <section className="paper panel">
      <h2>团规与内容开放</h2>
      <label className="field">
        本团名称
        <input value={n} onChange={(e) => setN(e.target.value)} />
      </label>
      <div className="form-grid">
        <Choice
          label="多属性伤害的取整方式"
          value={r.rounding}
          onChange={(s) => setR({ ...r, rounding: s as Rulings["rounding"] })}
          options={[
            { value: "unset", label: "尚未裁定（有差异时不输出确定伤害）" },
            { value: "total", label: "先相加，再向下取整" },
            { value: "terms", label: "每项先向下取整，再相加" },
          ]}
        />
        <Choice
          label="固定数值伤害"
          value={r.fixedDamage}
          onChange={(s) =>
            setR({ ...r, fixedDamage: s as Rulings["fixedDamage"] })
          }
          options={[
            { value: "unset", label: "尚未裁定" },
            { value: "fixed", label: "按固定值，不加武器与技能" },
            { value: "bonuses", label: "叠加武器、技能及常驻加成" },
          ]}
        />
        <Choice
          label="武器技能伤害加值"
          value={r.weaponSkill}
          onChange={(s) =>
            setR({ ...r, weaponSkill: s as Rulings["weaponSkill"] })
          }
          options={[
            { value: "tier", label: "当前档位乘等级（5 级为 +10）" },
            { value: "progressive", label: "各档累计（5 级为 +6）" },
          ]}
        />
      </div>
      <p className="muted">
        规则文字涉及解释差异的部分在此统一裁定。所有角色、试配与招式计算使用同一设置。
      </p>
      <Check
        label="正式角色可学习拓展书内容"
        checked={r.allowExpansion}
        onChange={(v) => setR({ ...r, allowExpansion: v })}
      />
      <label className="field">
        搜索要关闭的功法 / 套路
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="关闭后仍可浏览和试配"
        />
      </label>
      {found.map((e) => (
        <div className="reference-row" key={e.id}>
          <span>{e.name}</span>
          <button
            className="button"
            onClick={() =>
              setR({
                ...r,
                blockedIds: r.blockedIds.includes(e.id)
                  ? r.blockedIds.filter((x) => x !== e.id)
                  : [...r.blockedIds, e.id],
              })
            }
          >
            {r.blockedIds.includes(e.id) ? "恢复开放" : "本团关闭"}
          </button>
        </div>
      ))}
      <div className="condition-list">
        {r.blockedIds.map((id) => (
          <span key={id}>
            {getEntry(id)?.name}
            <button
              aria-label="恢复开放"
              onClick={() =>
                setR({ ...r, blockedIds: r.blockedIds.filter((x) => x !== id) })
              }
            >
              {" "}
              ×
            </button>
          </span>
        ))}
      </div>
      <button
        className="button primary"
        disabled={a.busy || !a.online}
        onClick={() => a.mutate("rules", { name: n, rules: r })}
      >
        保存团规
      </button>
    </section>
  );
}
