"use client";
import { contentPack } from "@/lib/content-pack";
import { matchesLearningCategory } from "@/lib/library-index";
import { isFavoriteMove } from "@/lib/move-favorites";
import { buildResourceChanges } from "@/lib/tabletop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addEntry,
  catalog,
  getEntry,
  innerRanks,
  invested,
  maxRank,
  rankLabel,
  trainingCost,
  xpCost,
  ranks,
  sourceLabel,
} from "@/lib/catalog";
import {
  calculateCharacter,
  calculateMove,
  learningIssues,
  defaultRules,
} from "@/lib/rules";
import {
  backgroundBenefits,
  changeDraftBackground,
  createStarter,
  craftChoices,
  problemStep,
  saveBuildProblems,
  stepHelp,
} from "@/lib/onboarding";
import type { Build, Entry } from "@/lib/types";
import { RULES_VERSION, STAT_KEYS, STAT_NAMES } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  Check as CheckIcon,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { MoveBook } from "./move-book";
import type { Learned } from "@/lib/types";
import { InventoryEditor } from "./inventory";
import { RulesHelp } from "./rules-help";
import { useApp } from "./app-context";
import {
  Calculation,
  Check,
  Choice,
  EntryMeta,
  NumberField,
  StatGrid,
  Warnings,
  download,
} from "./common";
const steps = [
  "基础信息",
  "身世与门派",
  "内功",
  "武学",
  "装备与经脉",
  "核对结果",
];
export function Builder() {
  const a = useApp();
  return (
    <Dialog open={a.builderOpen && !!a.draft} onOpenChange={a.setBuilderOpen}>
      <DialogContent className="builder-dialog">
        <DialogTitle>
          {a.draft?.isNew ? "新建侠士" : "角色构筑"} ·{" "}
          {a.draft?.build.name || "未命名"}
        </DialogTitle>
        <DialogDescription>
          修改保存在独立草稿中。退出不会更改正式角色；应用后才写入共享存档。
        </DialogDescription>
        {a.draft && <BuilderBody key={a.draft.id} />}
      </DialogContent>
    </Dialog>
  );
}
function BuilderBody() {
  const [acknowledgedChanges, setAcknowledgedChanges] = useState("");
  const a = useApp();
  const d = a.draft!;
  const b = d.build;
  const step = d.step ?? 0;
  const setStep = (value: number | ((s: number) => number)) =>
    a.setDraft({
      ...d,
      step: typeof value === "function" ? value(step) : value,
    });
  const [query, setQuery] = useState("");
  const [entryKind, setEntryKind] = useState("routine");
  const [onlySect, setOnlySect] = useState(true);
  const [beginnerOnly, setBeginnerOnly] = useState(d.isNew);
  const [visibleCount, setVisibleCount] = useState(45);
  const [rebaseChecked, setRebaseChecked] = useState(false);
  const [saveMode, setSaveMode] = useState("training");
  const [override, setOverride] = useState(false);
  const [scheme, setScheme] = useState("");
  const set = (partial: Partial<Build>) =>
    a.setDraft({ ...d, build: { ...b, ...partial } });
  const calc = calculateCharacter(b);
  const existing = a.campaign?.characters.find((x) => x.id === d.id);
  const before = existing ? calculateCharacter(existing.build) : undefined;
  const issues = saveBuildProblems(
    b,
    existing,
    a.campaign?.rules,
    d.isNew ? "creation" : saveMode,
    a.dm && override,
    a.dm,
  );
  const conflict = !!existing && existing.revision !== d.revision;
  const cost = existing ? trainingCost(existing.build, b, existing.growth?.progress) : 0;
  const chosenRank = (e: Entry) =>
    d.isNew && e.grade === "人级" ? (e.kind === "inner" ? 3 : 2) : 1;
  const alreadyAdded = (e: Entry) =>
    e.kind === "routine"
      ? catalog
          .filter((x) => x.parentId === e.id)
          .every((x) => b.moves.some((l) => l.id === x.id))
      : [...b.inner, ...b.moves].some((x) => x.id === e.id);
  const resetFilters = () => {
    setQuery("");
    setOnlySect(false);
    setBeginnerOnly(false);
    setVisibleCount(45);
  };
  const issueList = () => (
    <div className="readiness-list" aria-label="构筑待完成清单">
      {issues.length ? (
        issues.map((issue, i) => (
          <button key={i} onClick={() => setStep(problemStep(issue))}>
            <span>{steps[problemStep(issue)]}</span>
            {issue}
            <ArrowRight size={14} />
          </button>
        ))
      ) : (
        <p className="ready-note">
          <CheckIcon size={17} /> 必填选择已完成，可以核对并保存。
        </p>
      )}
    </div>
  );

  const filters = step === 2 ? "inner" : step === 3 ? entryKind : "meridian";
  const foundAll = catalog.filter(
    (e) =>
      matchesLearningCategory(e, filters) &&
      (!query || e.name.includes(query) || e.routine?.includes(query)) &&
      (!(step === 2 || step === 3) ||
        ((!onlySect ||
          !b.sect ||
          e.sect === b.sect ||
          (b.sect === "江湖散人" && e.sect === "江湖")) &&
          (!beginnerOnly || e.grade === "人级"))),
  );
  const found = foundAll.slice(0, visibleCount);
  const add = (e: Entry) => {
    const next = addEntry(
      b,
      e,
      step === 2 && d.isNew && e.grade === "人级"
        ? 3
        : step === 3 && d.isNew && e.grade === "人级"
          ? 2
          : 1,
    );
    a.setDraft({ ...d, build: next });
    a.setNotice("已加入草稿。");
  };
  const changeBackground = (id: string) => {
    if (!d.isNew) {
      set({ background: id, backgroundSkillChoice: "" });
      a.setNotice("已更改身世。已有角色的行囊与银两保留，请与 DM 核对调整。");
      return;
    }
    const changed = changeDraftBackground(b, id, d.backgroundGrant);
    a.setDraft({ ...d, build: changed.build, backgroundGrant: changed.grant });
  };
  const resourceChanges =
    !d.isNew && a.campaign?.characters.find((x) => x.id === d.id)
      ? buildResourceChanges(
          a.campaign.characters.find((x) => x.id === d.id)!,
          b,
        )
      : [];
  const changeSignature = JSON.stringify([existing?.revision, resourceChanges]);
  const resourceAcknowledged = acknowledgedChanges === changeSignature;
  const save = async () => {
    const success = await a.mutate("saveBuild", {
      id: d.id,
      revision: d.revision,
      build: b,
      mode: d.isNew ? "creation" : saveMode,
      override,
      acknowledged: resourceAcknowledged,
    });
    if (success) {
      a.select(d.id);
      a.setDraft(null);
      a.setBuilderOpen(false);
      a.setView("角色");
    }
  };
  const learnRow = (type: "inner" | "moves", l: Learned) => {
    const e = getEntry(l.id);
    if (!e) return null;
    const m =
      type === "moves"
        ? calculateMove(b, e.id, l.level, a.campaign?.rules)
        : null;
    return (
      <div className="learned-row" key={l.id}>
        <button className="learned-title" onClick={() => a.setDetail(e)}>
          <b>{e.name}</b>
          <small>
            {type === "moves"
              ? `${e.moveType ?? "散手"} · ${e.moveType === "架招" ? `格挡 ${m?.block}` : m?.damageType === "none" ? "辅助效果" : `伤害 ${m?.damage ?? "待裁定"}`} · 耗内 ${m?.mpCost ?? "待核对"}`
              : `${e.affinity} · ${sourceLabel(e)}`}
          </small>
        </button>
        <Choice
          label={e.name + "阶段"}
          value={String(l.level)}
          onChange={(s) =>
            set({
              [type]: b[type].map((x) =>
                x.id === l.id ? { ...x, level: Number(s) } : x,
              ),
            })
          }
          options={Array.from({ length: maxRank(e) }, (_, i) => ({
            value: String(i + 1),
            label: rankLabel(e,i+1),
          })).filter((x) => !e.music || x.value === "3")}
        />
        {type === "inner" && (
          <button
            className={
              "button " + (b.activeInner === l.id ? "active-choice" : "")
            }
            onClick={() => set({ activeInner: l.id })}
          >
            {b.activeInner === l.id ? "运行中" : "设为运行"}
          </button>
        )}
        <button
          className="icon-button"
          aria-label={"移除" + e.name}
          onClick={() =>
            set({
              [type]: b[type].filter((x) => x.id !== l.id),
              ...(type === "inner" && b.activeInner === l.id
                ? { activeInner: "" }
                : {}),
            })
          }
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };
  return (
    <>
      <div className="wizard-steps">
        {steps.map((s, i) => (
          <button
            key={s}
            aria-current={step === i ? "step" : undefined}
            className={step === i ? "selected" : ""}
            onClick={() => {
              setStep(i);
              setQuery("");
            }}
          >
            <span>{i + 1}</span>
            {s}
          </button>
        ))}
      </div>
      <div className="step-intro">
        <RulesHelp />
        <b>
          第 {step + 1} 步 · {steps[step]}
        </b>
        <p>{stepHelp[step]}</p>
      </div>
      <div className="builder-mobile-summary" aria-live="polite">
        气血 {calc.hpMax} · 内力 {calc.mpMax} ·{" "}
        {getEntry(b.activeInner)?.name ?? "尚未运行内功"}
        <button onClick={() => setStep(5)}>
          核对 {issues.length ? `${issues.length} 项` : "已就绪"}
        </button>
      </div>
      <div className="builder-layout">
        <section className="builder-main">
          {a.error && (
            <div className="inline-error" role="alert">
              {a.error}
            </div>
          )}
          {a.notice && (
            <p className="inline-notice" role="status">
              {a.notice}
            </p>
          )}
          {conflict && existing && (
            <section className="conflict-panel" role="alert">
              <h3>这张角色卡有了新版本，你的草稿仍保留</h3>
              <p>
                请核对最新角色与当前草稿。下方「当前正式角色 →
                你的草稿」列出所有发生变化的字段；继续后仍需手动应用。
              </p>
              <BuildDifferences current={existing.build} draft={b} />
              <Check
                label="我已核对变化，保留当前草稿继续编辑"
                checked={rebaseChecked}
                onChange={setRebaseChecked}
              />
              <div className="button-group">
                <button
                  className="button"
                  disabled={!rebaseChecked}
                  onClick={() => {
                    a.setDraft({ ...d, revision: existing.revision });
                    setRebaseChecked(false);
                    a.setError("");
                  }}
                >
                  保留草稿，以最新版本继续
                </button>
                <button
                  className="button subtle"
                  onClick={() => {
                    a.setDraft({
                      ...d,
                      build: structuredClone(existing.build),
                      revision: existing.revision,
                      backgroundGrant: undefined,
                    });
                    a.setError("");
                  }}
                >
                  放弃本草稿，载入最新角色
                </button>
              </div>
            </section>
          )}

          {step === 0 && (
            <>
              <h2>这位侠士，如何称呼？</h2>
              {d.isNew &&
                !b.background &&
                !b.inner.length &&
                !b.moves.length && (
                  <div className="starter-choice">
                    <p className="eyebrow">第一次玩 · 可以从这里开始</p>
                    <h3>{contentPack.starter.title}</h3>
                    <p>
                      替你配好身世、性格、内功、攻击、破防、架招与配套装备，再逐步解释每个选择。全部都能修改。
                    </p>
                    <button
                      className="button primary"
                      onClick={() => {
                        const starter = createStarter(b.name);
                        a.setDraft({
                          ...d,
                          build: starter.build,
                          backgroundGrant: starter.grant,
                          step: 1,
                        });
                        a.setNotice(
                          "示范已加入草稿，尚未建立正式角色。先看看身世与性格。",
                        );
                      }}
                    >
                      用入门示范开始
                    </button>
                    <small>
                      {contentPack.starter.description}
                    </small>
                  </div>
                )}
              <div className="form-grid">
                <label className="field">
                  姓名
                  <input
                    value={b.name}
                    maxLength={40}
                    placeholder="例如：行路人"
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </label>
                <Choice
                  label="角色类型"
                  value={b.kind}
                  onChange={(s) => set({ kind: s as "pc" | "npc" })}
                  options={[
                    { value: "pc", label: "玩家侠士" },
                    { value: "npc", label: "NPC / 敌人" },
                  ]}
                />
              </div>
              <label className="field">
                志向、外貌与人物笔记
                <textarea
                  value={b.notes}
                  rows={5}
                  maxLength={12000}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="你的江湖，从一个念头开始。"
                />
              </label>
              <details className="disclosure">
                <summary>与 DM 约定的开局资源</summary>
                <p className="muted">
                  默认丹田修为为0。开局赠送的已学功法不再扣一次修为；身世行囊会带入可识别的白银。
                </p>
                <div className="form-grid">
                  <NumberField
                    label="丹田修为（尚未投入的修为）"
                    value={b.xp}
                    onChange={(v) => set({ xp: v })}
                  />
                  <NumberField
                    label="白银（两）"
                    value={b.silver}
                    onChange={(v) => set({ silver: v })}
                  />
                </div>
              </details>
              <details className="disclosure">
                <summary>基础属性与 DM 修正</summary>
                <p className="muted">
                  普通人的六项基础属性均为 1；运行内功与永久收益会另外计算。NPC
                  可在这里设置基础值。
                </p>
                <div className="form-grid three">
                  {STAT_KEYS.map((k) => (
                    <NumberField
                      key={k}
                      label={STAT_NAMES[k]}
                      value={b.base[k]}
                      min={1}
                      onChange={(v) => set({ base: { ...b.base, [k]: v } })}
                    />
                  ))}
                </div>
                <NumberField
                  label="初始悟性"
                  value={b.insightBase}
                  min={1}
                  onChange={(v) => set({ insightBase: v })}
                />
              </details>
            </>
          )}
          {step === 1 && (
            <>
              <h2>出身与性情</h2>
              <div className="form-grid">
                <Choice
                  label="身世背景"
                  value={b.background}
                  onChange={changeBackground}
                  options={[
                    { value: "", label: "选择身世" },
                    ...catalog
                      .filter((x) => x.kind === "background")
                      .map((e) => ({ value: e.id, label: e.name })),
                  ]}
                />
                <Choice
                  label="性格"
                  value={b.personality}
                  onChange={(id) =>
                    set({ personality: id, personalityChoices: [] })
                  }
                  options={[
                    { value: "", label: "选择性格" },
                    ...catalog
                      .filter((x) => x.kind === "personality")
                      .map((e) => ({ value: e.id, label: e.name })),
                  ]}
                />
              </div>
              {b.background && (
                <div className="inset">
                  <p className="rule-text">{getEntry(b.background)?.text}</p>
                  <small>
                    {d.isNew
                      ? "背景自动赠送的武学、物品会随身世替换；已升级招式和原本拥有的物品保留。"
                      : "已有角色更改身世不会重新领取赠品。"}
                  </small>
                </div>
              )}
              {b.background && (
                <div className="benefit-summary">
                  <b>背景带来什么</b>
                  <p>
                    {backgroundBenefits(b.background).routine?.name ??
                      "无已识别背景武学"}{" "}
                    · 白银 {backgroundBenefits(b.background).silver} 两
                  </p>
                  <p className="muted">
                    {backgroundBenefits(b.background)
                      .equipment.map((e) => e.name)
                      .join("、") || "其余物品请核对原文"}
                  </p>
                  <Warnings
                    items={backgroundBenefits(b.background).warnings}
                    title="行囊待核对"
                  />
                  {getEntry(b.background)?.name === "小贩" && (
                    <Choice
                      label="身世赠送技艺（任选一项 +1）"
                      value={b.backgroundSkillChoice ?? ""}
                      onChange={(v) => set({ backgroundSkillChoice: v })}
                      options={[
                        { value: "", label: "选择一项技艺" },
                        ...craftChoices.map((value) => ({
                          value,
                          label: value,
                        })),
                      ]}
                    />
                  )}
                </div>
              )}
              {b.personality && (
                <div className="inset">
                  <p>选择两项性格技能，各获得 +2</p>
                  <div className="check-grid">
                    {getEntry(b.personality)?.choices?.map((s) => (
                      <Check
                        key={s}
                        label={s}
                        checked={b.personalityChoices.includes(s)}
                        disabled={
                          b.personalityChoices.length >= 2 &&
                          !b.personalityChoices.includes(s)
                        }
                        onChange={(v) =>
                          set({
                            personalityChoices: v
                              ? [...b.personalityChoices, s]
                              : b.personalityChoices.filter((x) => x !== s),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              <Choice
                label="门派与传承"
                value={b.sect}
                onChange={(s) => set({ sect: s })}
                options={[
                  "",
                  ...[
                    ...new Set(
                      catalog
                        .filter((e) => e.kind === "sect")
                        .map((e) => e.name),
                    ),
                  ].filter(Boolean),
                  "江湖散人",
                ].map((s) => ({
                  value: s,
                  label: s
                    ? s +
                      (catalog.some(
                        (e) =>
                          e.kind === "sect" &&
                          e.name === s &&
                          e.source.book === "core",
                      )
                        ? ` · ${contentPack.sources.core}`
                        : " · 特殊开局，先问 DM")
                    : "选择门派",
                }))}
              />
              <p className="muted">
                先与 DM 确认开局功法、阶段和资源，再选择门派与传承。资料包的入门示范可作为试配起点。
              </p>
              <details className="disclosure">
                <summary>技艺与其他技能等级</summary>
                <div className="form-grid three">
                  {[
                    "农事",
                    "驭兽",
                    "锻造",
                    "成衣",
                    "制宝",
                    "医术",
                    "烹饪",
                    "毒术",
                    "茶道",
                    "酒艺",
                    "书写",
                    "作画",
                    "演奏",
                    "棋术",
                    "表演",
                    "道法",
                    "佛法",
                    "乞讨",
                  ].map((s) => (
                    <NumberField
                      key={s}
                      label={s + "（额外）"}
                      value={b.skillChoices[s] ?? 0}
                      onChange={(v) =>
                        set({ skillChoices: { ...b.skillChoices, [s]: v } })
                      }
                    />
                  ))}
                </div>
              </details>
            </>
          )}
          {(step === 2 || step === 3) && (
            <>
              <div className="section-heading">
                <h2>{step === 2 ? "已学内功" : "已学武学与散手"}</h2>
                <small>{b[step === 2 ? "inner" : "moves"].length} 项</small>
              </div>
              {step === 2 ? (
                <>
                  <p className="muted">
                    只运行一门内功；每本已修满内功的永久收益均计算一次。
                  </p>
                  {b.inner.map((l) => learnRow("inner", l))}
                </>
              ) : (
                <>
                  <MoveBook
                    build={b}
                    rules={a.campaign?.rules}
                    onDetail={a.setDetail}
                    title=""
                    renderMove={(l) => learnRow("moves", l)}
                  />
                  <Choice
                    label="添加方式"
                    value={entryKind}
                    onChange={setEntryKind}
                    options={[
                      { value: "routine", label: "整套武学" },
                      { value: "move", label: "逐招学习" },
                      { value: "special", label: "独立散手" },
                      { value: "lightness", label: "轻功" },
                      { value: "music", label: "乐谱 · 通读精通" },
                    ]}
                  />
                </>
              )}
              {!b[step === 2 ? "inner" : "moves"].length && (
                <p className="inset muted">在下方搜索并选择一门功法。</p>
              )}
              <div className="picker-tools">
                <label className="field grow">
                  搜索功法
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setVisibleCount(45);
                    }}
                    placeholder="输入功法或招式名称"
                  />
                </label>
                <Check
                  label="仅看本门"
                  checked={onlySect}
                  onChange={setOnlySect}
                />
              </div>
              <Check
                label="开局优先：仅看人级功法"
                checked={beginnerOnly}
                onChange={setBeginnerOnly}
              />
              <p className="muted">
                找到 {foundAll.length} 项 · 已显示 {found.length}{" "}
                项。名字旁可查看为什么能学、会增加什么。
              </p>
              <div className="picker-list">
                {found.map((e) => (
                  <div className="picker-row" key={e.id}>
                    <button onClick={() => a.setDetail(e)}>
                      <b>{e.name}</b>
                      <EntryMeta entry={e} />
                      <small>
                        {learningIssues(
                          b,
                          e,
                          a.campaign?.rules ?? defaultRules,
                        )[0] ?? "符合当前已检查的学习条件"}
                      </small>
                      <small>
                        加入至
                        {e.kind === "inner"
                          ? innerRanks[chosenRank(e)]
                          : ranks[e.music ? 3 : chosenRank(e)]}{" "}
                        · 累计投入{" "}
                        {e.kind === "routine"
                          ? catalog
                              .filter((x) => x.parentId === e.id)
                              .reduce((n, x) => n + xpCost(x, chosenRank(e)), 0)
                          : xpCost(e, chosenRank(e))}{" "}
                        修为{d.isNew ? "（开局赠送范围请与 DM 核对）" : ""}
                      </small>
                    </button>
                    <button
                      className="button"
                      disabled={alreadyAdded(e)}
                      onClick={() => add(e)}
                    >
                      <Plus size={15} />
                      {alreadyAdded(e) ? "已加入" : "加入"}
                    </button>
                  </div>
                ))}
              </div>
              {found.length < foundAll.length && (
                <button
                  className="button full-width"
                  onClick={() => setVisibleCount((n) => n + 45)}
                >
                  再显示45项（还有 {foundAll.length - found.length} 项）
                </button>
              )}
              {!found.length && (
                <div className="inset">
                  <p>
                    当前筛选没有找到功法。可以查看全书，试配不会受本团开放范围限制。
                  </p>
                  <button className="button" onClick={resetFilters}>
                    清除筛选，查看全部
                  </button>
                </div>
              )}
              <p className="muted">
                加入不会降低已有阶段；需要修改阶段时，在上方已学列表操作。
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <h2>行囊、穿戴与持握</h2>
              <InventoryEditor
                build={b}
                onChange={(build) => a.setDraft({ ...d, build })}
                allowEquip
              />
              <h2 className="inventory-section-title">经脉与成长</h2>
              <div className="selected-items">
                {b.meridians.map((id) => (
                  <div className="learned-row" key={id}>
                    <button onClick={() => a.setDetail(getEntry(id)!)}>
                      {getEntry(id)?.name} <small>{getEntry(id)?.grade}</small>
                    </button>
                    <button
                      className="icon-button"
                      aria-label="移除经脉"
                      onClick={() =>
                        set({ meridians: b.meridians.filter((x) => x !== id) })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-grid">
                <label className="field">
                  搜索
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setVisibleCount(45);
                    }}
                    placeholder="经脉名称"
                  />
                </label>
              </div>
              <div className="picker-list short">
                {found.map((e) => (
                  <div className="picker-row" key={e.id}>
                    <button onClick={() => a.setDetail(e)}>
                      <b>{e.name}</b>
                      <small>
                        {e.slot ?? e.grade} · {sourceLabel(e)}
                      </small>
                    </button>
                    <button
                      className="button"
                      disabled={[...b.equipment, ...b.meridians].includes(e.id)}
                      onClick={() => add(e)}
                    >
                      加入
                    </button>
                  </div>
                ))}
              </div>
              {found.length < foundAll.length && (
                <button
                  className="button full-width"
                  onClick={() => setVisibleCount((n) => n + 45)}
                >
                  显示更多（还有 {foundAll.length - found.length} 项）
                </button>
              )}
              {!found.length && (
                <div className="inset">
                  <p>没有找到对应经脉。</p>
                  <button className="button" onClick={resetFilters}>
                    清除搜索
                  </button>
                </div>
              )}
              <details
                className="disclosure"
                open={
                  b.meridians.length > 0 ||
                  b.equipment.some((id) => getEntry(id)?.freePoints)
                }
              >
                <summary>分配经脉与装备提供的自由属性</summary>
                <Check
                  label="已完成生死玄关（由 DM 核对检定）"
                  checked={b.traits.includes("玄关")}
                  onChange={(v) =>
                    set({
                      traits: v
                        ? [...b.traits, "玄关"]
                        : b.traits.filter((x) => x !== "玄关"),
                    })
                  }
                />
                <p className="muted">
                  可分配{" "}
                  {[...new Set([...b.meridians, ...b.equipment])].reduce(
                    (n, id) => n + (getEntry(id)?.freePoints ?? 0),
                    0,
                  ) + (b.traits.includes("玄关") ? 100 : 0)}{" "}
                  点；已分配{" "}
                  {Object.values(b.freeAttributes).reduce((n, v) => n + v, 0)}{" "}
                  点。经脉冲关检定与对应内功消耗须由 DM 核对。
                </p>
                <div className="form-grid three">
                  {STAT_KEYS.map((k) => (
                    <NumberField
                      key={k}
                      label={STAT_NAMES[k]}
                      value={b.freeAttributes[k]}
                      onChange={(v) =>
                        set({ freeAttributes: { ...b.freeAttributes, [k]: v } })
                      }
                    />
                  ))}
                </div>
              </details>
            </>
          )}
          {step === 5 && (
            <>
              <h2>你的侠士，上桌能做什么？</h2>
              <div className="ready-loadout">
                <p>
                  运行 <b>{getEntry(b.activeInner)?.name ?? "未选择"}</b> · 持握{" "}
                  <b>{getEntry(b.activeWeapon)?.name ?? "徒手 / 未选择武器"}</b>
                </p>
                {["实招", "虚招", "架招", "反击"].map((type) => {
                  const move =
                    b.moves.find(
                      (x) =>
                        isFavoriteMove(b, x.id) &&
                        getEntry(x.id)?.moveType === type,
                    ) ?? b.moves.find((x) => getEntry(x.id)?.moveType === type);
                  const e = move && getEntry(move.id);
                  const m =
                    move &&
                    calculateMove(b, move.id, move.level, a.campaign?.rules);
                  return (
                    <div className="loadout-row" key={type}>
                      <b>
                        {
                          {
                            实招: "打出伤害",
                            虚招: "试图破架",
                            架招: "开启防守",
                            反击: "按触发还手",
                          }[type]
                        }
                      </b>
                      {e ? (
                        <button
                          className="text-button"
                          onClick={() => a.setDetail(e)}
                        >
                          {e.name} ·{" "}
                          {type === "架招"
                            ? `格挡 ${m?.block}`
                            : `基础伤害 ${m?.damage ?? "待裁定"}`}{" "}
                          · 耗内 {m?.mpCost ?? "待核对"}
                        </button>
                      ) : (
                        <span className="muted">尚未学习（可按玩法选择）</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {issueList()}
              {!!resourceChanges.length && (
                <div className="warning-box">
                  <b>应用后当前记录会变化</b>
                  {resourceChanges.map((t) => (
                    <p key={t}>{t}</p>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={resourceAcknowledged}
                      onChange={(e) =>
                        setAcknowledgedChanges(
                          e.target.checked ? changeSignature : "",
                        )
                      }
                    />
                    已核对以上变化
                  </label>
                </div>
              )}
              <StatGrid result={calc} />
              <Calculation result={calc} />
              <div className="budget-panel">
                <div>
                  <span>构筑累计投入</span>
                  <b>{invested(b)}</b>
                </div>
                <div>
                  <span>丹田可用修为</span>
                  <b>{existing?.build.xp ?? b.xp}</b>
                </div>
                <div>
                  <span>{d.isNew ? "创建时扣除" : "本次修炼花费"}</span>
                  <b>{cost}</b>
                </div>
                <p>
                  {d.isNew
                    ? "开局功法属于已修内容，建立角色不会再次扣除。开局范围仍以本团约定为准。"
                    : `训练后剩余 ${Math.max(0, (existing?.build.xp ?? b.xp) - cost)}。移除或降级旧功法不抵扣新功法花费。`}
                </p>
              </div>
              {!d.isNew && (
                <Choice
                  label="应用方式"
                  value={saveMode}
                  onChange={setSaveMode}
                  options={[
                    { value: "training", label: "修炼并消耗修为" },
                    ...(a.dm
                      ? [{ value: "edit", label: "DM 修正 / 跨日成长" }]
                      : []),
                  ]}
                />
              )}
              <p className="muted">
                阶段成本按正式书 19–20
                页计算。特殊秘籍成本、修炼瓶颈、经脉检定和跨日训练须记录 DM
                裁定。
              </p>
              {a.dm && (
                <Check
                  label="DM 已核对特殊学习条件及跨日训练"
                  checked={override}
                  onChange={setOverride}
                />
              )}
              <div className="inset">
                <h3>保存一个构筑方案</h3>
                <div className="inline-form">
                  <label className="field grow">
                    方案名称
                    <input
                      value={scheme}
                      onChange={(e) => setScheme(e.target.value)}
                      placeholder="例如：太极 · 守势"
                    />
                  </label>
                  <button
                    className="button"
                    disabled={!scheme.trim() || !a.online || a.busy}
                    onClick={async () => {
                      if (
                        await a.mutate("saveSnapshot", {
                          id: crypto.randomUUID(),
                          name: scheme,
                          characterId: d.isNew ? "" : d.id,
                          build: b,
                          createdAt: new Date().toISOString(),
                        })
                      )
                        setScheme("");
                    }}
                  >
                    <Save size={16} />
                    保存方案
                  </button>
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    download((b.name || "侠士") + "-构筑草稿.json", {
                      format: "xia-build-v1",
                      rulesVersion: RULES_VERSION,
                      build: b,
                    })
                  }
                >
                  导出草稿到设备
                </button>
              </div>
              <details className="disclosure">
                <summary>添加带说明的 DM 固定修正</summary>
                <p className="muted">
                  用于团规、永久奖励和已经裁定的常驻效果，每一项都会出现在计算明细中。
                </p>
                {b.bonuses.map((m, i) => (
                  <div className="bonus-row" key={i}>
                    <input
                      aria-label="修正来源"
                      placeholder="来源说明"
                      value={m.label}
                      onChange={(e) =>
                        set({
                          bonuses: b.bonuses.map((x, n) =>
                            n === i ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Choice
                      label="属性"
                      value={m.key}
                      onChange={(k) =>
                        set({
                          bonuses: b.bonuses.map((x, n) =>
                            n === i ? { ...x, key: k } : x,
                          ),
                        })
                      }
                      options={[
                        ...STAT_KEYS.map((value) => ({
                          value,
                          label: STAT_NAMES[value],
                        })),
                        ...Object.entries({
                          hpMax: "气血上限",
                          mpMax: "内力上限",
                          flatDamage: "招式伤害",
                          block: "格挡",
                          physicalDefense: "外防",
                          internalDefense: "内防",
                          physicalHit: "外命中",
                          internalHit: "内命中",
                          physicalCrit: "外暴击骰",
                          internalCrit: "内暴击骰",
                          insight: "悟性",
                          speed: "速度",
                          dodge: "闪避",
                          lookThrough: "看破",
                        }).map(([value, label]) => ({ value, label })),
                      ]}
                    />
                    <NumberField
                      label="加值"
                      min={-10000}
                      value={m.value}
                      onChange={(v) =>
                        set({
                          bonuses: b.bonuses.map((x, n) =>
                            n === i ? { ...x, value: v } : x,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label="移除修正"
                      onClick={() =>
                        set({ bonuses: b.bonuses.filter((_, n) => n !== i) })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="button"
                  onClick={() =>
                    set({
                      bonuses: [
                        ...b.bonuses,
                        { key: "flatDamage", value: 0, label: "" },
                      ],
                    })
                  }
                >
                  添加修正
                </button>
              </details>
            </>
          )}
        </section>
        <aside className="builder-preview">
          <p className="eyebrow">随选择实时计算</p>
          <h2>{b.name || "未命名侠士"}</h2>
          <StatGrid result={calc} previous={before} />
          <div className="resource-preview">
            <div>
              <small>气血上限</small>
              <b>{calc.hpMax}</b>
              {before && (
                <em>
                  {calc.hpMax - before.hpMax >= 0 ? "+" : ""}
                  {calc.hpMax - before.hpMax}
                </em>
              )}
            </div>
            <div>
              <small>内力上限</small>
              <b>{calc.mpMax}</b>
              {before && (
                <em>
                  {calc.mpMax - before.mpMax >= 0 ? "+" : ""}
                  {calc.mpMax - before.mpMax}
                </em>
              )}
            </div>
          </div>
          <p className="muted">
            运行 {getEntry(b.activeInner)?.name ?? "未设置"}
            <br />
            悟性 {calc.insight} · 内功境界 {calc.realm}
          </p>
          {b.moves.slice(0, 5).map((l) => {
            const m = calculateMove(b, l.id, l.level, a.campaign?.rules);
            return (
              <div className="mini-move" key={l.id}>
                <span>{m.name}</span>
                <b>{m.type === "架招" ? `格挡 ${m.block}` : m.damageType === "none" ? "效果招式" : m.damage ?? "待定"}</b>
              </div>
            );
          })}
          {issueList()}
          {!!resourceChanges.length && (
            <div className="warning-box">
              <b>应用后当前记录会变化</b>
              {resourceChanges.map((t) => (
                <p key={t}>{t}</p>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={resourceAcknowledged}
                  onChange={(e) =>
                    setAcknowledgedChanges(
                      e.target.checked ? changeSignature : "",
                    )
                  }
                />
                已核对以上变化
              </label>
            </div>
          )}
          <Warnings items={calc.warnings} title="条件效果待核对" />
          <button
            className="text-button"
            onClick={() => {
              a.setBuilderOpen(false);
              a.setView("资料库");
            }}
          >
            去资料库继续挑选 →
          </button>
        </aside>
      </div>
      <div className="dialog-actionbar">
        <button
          className="button subtle"
          onClick={() => a.setBuilderOpen(false)}
        >
          暂存并退出
        </button>
        <span className="muted">草稿已留在这台设备</span>
        <div className="button-group">
          <button
            className="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft size={16} />
            上一步
          </button>
          {step < 5 ? (
            <button
              className="button primary"
              onClick={() => {
                setStep((s) => s + 1);
                setQuery("");
              }}
            >
              下一步 <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="button primary"
              disabled={
                !!issues.length ||
                conflict ||
                a.busy ||
                !a.online ||
                (!!resourceChanges.length && !resourceAcknowledged)
              }
              onClick={save}
            >
              <CheckIcon size={16} />
              {a.busy
                ? "正在保存…"
                : !a.online
                  ? "离线：草稿已保留"
                  : d.isNew
                    ? "建立正式角色"
                    : "应用到角色"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function BuildDifferences({
  current,
  draft,
}: {
  current: Build;
  draft: Build;
}) {
  const labels: Record<string, string> = {
    name: "姓名",
    kind: "角色类型",
    sect: "门派",
    background: "身世",
    backgroundSkillChoice: "身世自选技艺",
    personality: "性格",
    personalityChoices: "性格技能",
    freeAttributes: "自由属性",
    base: "基础属性",
    insightBase: "初始悟性",
    skillChoices: "额外技能",
    inner: "已学内功",
    activeInner: "运行内功",
    moves: "已学招式",
    equipment: "已装备与启用",
    inventory: "行囊持有物品",
    activeWeapon: "持握武器",
    meridians: "经脉",
    traits: "其他特性",
    bonuses: "固定修正",
    xp: "丹田修为",
    silver: "白银",
    notes: "人物笔记",
    favorites: "常用武学",
  };
  function display(value: unknown): string {
    if (value === undefined || value === "") return "无";
    if (typeof value === "string") return getEntry(value)?.name ?? value;
    if (Array.isArray(value))
      return value.length ? value.map(display).join("、") : "无";
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if ("id" in obj && "level" in obj)
        return `${display(obj.id)} 第${obj.level}阶段`;
      return Object.entries(obj)
        .map(
          ([k, v]) =>
            `${STAT_NAMES[k as keyof typeof STAT_NAMES] ?? k}：${display(v)}`,
        )
        .join("；");
    }
    return String(value);
  }
  return (
    <details className="disclosure" open>
      <summary>逐项比较（正式角色 → 草稿）</summary>
      {Object.keys(labels)
        .filter(
          (k) =>
            JSON.stringify(current[k as keyof Build]) !==
            JSON.stringify(draft[k as keyof Build]),
        )
        .map((k) => (
          <div className="conflict-row" key={k}>
            <b>{labels[k]}</b>
            <div>
              {display(current[k as keyof Build])}
              <span>→</span>
              {display(draft[k as keyof Build])}
            </div>
          </div>
        ))}
    </details>
  );
}
