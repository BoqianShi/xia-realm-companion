import { applyGrowth, growthData } from "./growth.ts";
import { saveBuildProblems } from "./onboarding.ts";
import { applyHost, emptyHosting, HostError } from "./hosting.ts";
import { getModule } from "./modules.ts";
import type { ModuleNotebook } from "./module-types.ts";
import {
  applyTableOperation,
  buildResourceChanges,
  loadoutBuild,
} from "./tabletop.ts";
import { z } from "zod";
import { mergePortraits, portraitIdSchema, portraitsSchema } from "./portraits.ts";
import {
  getEntry,
  inventoryIssues,
  inventoryName,
  ownedItems,
  trainingCost,
  xpCost,
  DATA_REVISION,
} from "./catalog.ts";
import {
  activeInner,
  buildIssues,
  calculateCharacter,
  defaultRules,
  emptyRuntime,
  has,
  previewAction,
  stack,
} from "./rules.ts";
import type { Campaign, Character, Runtime } from "./types.ts";
import type { Command } from "./validation.ts";
import {
  actionSchema,
  buildSchema,
  campaignSchema,
  rulesSchema,
  runtimeSchema,
  snapshotSchema,
  inventorySchema,
  tableCommandSchema,
} from "./validation.ts";
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function emptyCampaign(): Campaign {
  return {
    name: "我们的江湖",
    rules: { ...defaultRules },
    characters: [],
    snapshots: [],
    pending: [],
    encounter: { active: false, round: 0, turn: 0, order: [] },
    logs: [],
    receipts: {},
    modules: [],
    hosting: emptyHosting(),
  };
}
const clone = <T>(x: T): T => structuredClone(x);
export function changeCondition(
  r: Runtime,
  name: string,
  delta: number,
  anchor = "",
  duration: number | null = null,
  cap = 1000,
) {
  const old = r.conditions.find((x) => x.name === name);
  if (old) {
    old.stacks = Math.min(cap, old.stacks + delta);
    if (duration !== null) old.remaining = (old.remaining ?? 0) + duration;
    r.conditions = r.conditions.filter((x) => x.stacks > 0);
  } else if (delta > 0)
    r.conditions.push({
      id: crypto.randomUUID(),
      name,
      stacks: Math.min(cap, delta),
      remaining: duration,
      anchor,
      note: "",
    });
}
function assert(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export function applyCommand(current: Campaign, cmd: Command): Campaign {
  let c = clone(current);
  const now = new Date().toISOString();
  const isDm = cmd.role === "dm";
  const dmTypes = [
    "importModules",
    "saveModule",
    "confirmAction",
    "rejectAction",
    "setRuntime",
    "rules",
    "encounter",
    "nextTurn",
    "undo",
    "restore",
  ];
  if (dmTypes.includes(cmd.type))
    assert(isDm, "此操作需要切换到主持人视图。", 403);
  const char = (id: string) => {
    const x = c.characters.find((x) => x.id === id);
    assert(x, "角色不存在。", 404);
    return x;
  };
  const log = (
    label: string,
    before: Record<string, Character>,
    details: string[],
    encounterBefore?: Campaign["encounter"],
    table = false,
  ) => {
    c.logs.unshift({
      id: crypto.randomUUID(),
      label,
      by: cmd.by,
      at: now,
      details,
      before,
      afterRevisions: Object.fromEntries(
        Object.keys(before).map((id) => [id, char(id).revision]),
      ),
      encounterBefore,
      encounterAfter: encounterBefore ? clone(c.encounter) : undefined,
      undone: false,
      table,
    });
    c.logs = c.logs.slice(0, 500);
  };
  const touch = (x: Character) => {
    x.revision++;
    x.dataRevision = DATA_REVISION;
  };
  if (cmd.type === "grow") {
    const p = z
      .object({
        id: z.string(),
        revision: z.number().int(),
        operation: z.unknown(),
      })
      .parse(cmd.payload);
    const ch = char(p.id);
    assert(
      ch.revision === p.revision,
      "角色已有更新，请保留输入并核对后保存。",
      409,
    );
    const before = { [ch.id]: clone(ch) };
    const label = applyGrowth(ch, p.operation, c.rules);
    touch(ch);
    log(label, before, [label], undefined, true);
  }
  if (cmd.type === "host" || cmd.type === "hostRoll") {
    const p = z
      .object({ revision: z.number().int().min(0), operation: z.unknown() })
      .parse(cmd.payload);
    const portraitInput = z.object({ portraits: portraitsSchema.optional() }).parse(p.operation);
    if (portraitInput.portraits) {
      assert(isDm, "NPC 头像请在主持人视图修改。");
      try { c.portraits = mergePortraits(c.portraits, portraitInput.portraits); }
      catch (e) { throw new DomainError(e instanceof Error ? e.message : "头像未能保存。"); }
    }
    if (cmd.type === "hostRoll")
      assert(
        !!p.operation &&
          typeof p.operation === "object" &&
          "kind" in p.operation &&
          ["roll", "autoRoll"].includes(String(p.operation.kind)),
        "此入口只能处理自己的先攻骰。",
      );
    try {
      c.hosting = applyHost(
        c,
        { revision: p.revision, operation: p.operation },
        isDm,
      );
    } catch (e) {
      if (e instanceof HostError) throw new DomainError(e.message, e.status);
      throw e;
    }
  }
  if (cmd.type === "savePortrait") {
    const p = z.object({ id: z.string(), revision: z.number().int(), portraitId: portraitIdSchema, portraits: portraitsSchema.optional() }).parse(cmd.payload);
    const ch = char(p.id);
    assert(ch.revision === p.revision, "角色已有更新，头像草稿已保留；请核对后保存。", 409);
    try { c.portraits = mergePortraits(c.portraits, p.portraits); }
    catch (e) { throw new DomainError(e instanceof Error ? e.message : "头像未能保存。"); }
    assert(!p.portraitId || c.portraits[p.portraitId], "头像资料缺失，请重新选择图片。");
    const before = { [ch.id]: clone(ch) };
    ch.portraitId = p.portraitId;
    touch(ch);
    log("头像 · " + ch.build.name, before, [p.portraitId ? "更新头像" : "移除头像"], undefined, true);
  }
  if (cmd.type === "importModules") {
    const p = z
      .object({ ids: z.array(z.string()).min(1).max(100) })
      .parse(cmd.payload);
    assert(
      p.ids.every((id) => getModule(id)),
      "包含未收录的模组，无法导入。",
    );
    const before: Record<string, ModuleNotebook | null> = {};
    c.modules ??= [];
    for (const id of new Set(p.ids)) {
      if (c.modules.some((m) => m.id === id)) continue;
      const source = getModule(id)!;
      before[id] = null;
      c.modules.push({
        id,
        sourceVersion: source.version,
        revision: 1,
        importedAt: now,
        updatedAt: now,
        notes: "",
        completed: [],
        bookmark: source.sections[0]?.page ?? 1,
      });
    }
    if (Object.keys(before).length) {
      log(
        "导入模组",
        {},
        Object.keys(before).map((id) => getModule(id)!.title),
      );
      c.logs[0].moduleBefore = before;
      c.logs[0].moduleAfterRevisions = Object.fromEntries(
        Object.keys(before).map((id) => [id, 1]),
      );
    }
  }
  if (cmd.type === "saveModule") {
    const p = z
      .object({
        id: z.string(),
        revision: z.number().int(),
        notes: z.string().max(30000).optional(),
        completed: z.array(z.string()).max(300).optional(),
        bookmark: z.number().int().min(1).optional(),
      })
      .parse(cmd.payload);
    const source = getModule(p.id),
      notebook = c.modules?.find((m) => m.id === p.id);
    assert(source && notebook, "请先导入该模组。");
    assert(
      notebook.revision === p.revision,
      "这本模组已有新记录；你的输入已保留，请核对后再保存。",
      409,
    );
    assert(
      notebook.sourceVersion === source.version,
      "模组资料版本已变化，请先核对当前原书版本。",
    );
    if (p.completed)
      assert(
        p.completed.every((id) => source.sections.some((s) => s.id === id)),
        "包含不存在的章节。",
      );
    if (p.bookmark)
      assert(p.bookmark <= source.pageCount, "书签页码超出模组范围。");
    const before = clone(notebook);
    if (p.notes !== undefined) notebook.notes = p.notes;
    if (p.completed !== undefined)
      notebook.completed = [...new Set(p.completed)];
    if (p.bookmark !== undefined) notebook.bookmark = p.bookmark;
    notebook.revision++;
    notebook.updatedAt = now;
    log("备团记录 · " + source.title, {}, [
      p.notes !== undefined ? "更新带团笔记" : "更新章节进度或书签",
    ]);
    c.logs[0].moduleBefore = { [p.id]: before };
    c.logs[0].moduleAfterRevisions = { [p.id]: notebook.revision };
  }
  if (cmd.type === "tableEdit") {
    const p = tableCommandSchema.parse(cmd.payload);
    const x = char(p.id);
    assert(
      x.revision === p.revision,
      "这张角色卡已有新记录，请核对最新数值后再保存。",
      409,
    );
    try {
      if (p.operation.kind === "loadout") {
        const changes = buildResourceChanges(
          x,
          loadoutBuild(x, p.operation.field, p.operation.value),
        );
        assert(!changes.length || p.acknowledged, "请确认新上限和架招变化。");
      }
      const result = applyTableOperation(x, p.operation, now, cmd.requestId);
      const before = { [x.id]: clone(x) };
      result.character.revision = x.revision + 1;
      c.characters = c.characters.map((ch) =>
        ch.id === x.id ? result.character : ch,
      );
      log(
        "桌边记录 · " + x.build.name,
        before,
        result.details,
        undefined,
        true,
      );
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(e instanceof Error ? e.message : "记录无效。");
    }
  }
  if (cmd.type === "saveBuild") {
    const p = z
      .object({
        id: z.string(),
        revision: z.number().int().nonnegative(),
        build: buildSchema,
        mode: z.enum(["creation", "edit", "training"]),
        override: z.boolean().default(false),
        acknowledged: z.boolean().default(false),
      })
      .parse(cmd.payload);
    const old = c.characters.find((x) => x.id === p.id);
    const issues = saveBuildProblems(
      p.build,
      old,
      c.rules,
      p.mode,
      isDm && p.override,
      isDm,
    );
    assert(!issues.length, issues.join("\n"));
    assert(
      !old || old.revision === p.revision,
      "这张角色卡已更新，请刷新后再应用草稿。",
      409,
    );
    if (old) {
      const before = { [old.id]: clone(old) };
      const prev = calculateCharacter(old.build);
      const next = calculateCharacter(p.build);
      const cost = trainingCost(old.build, p.build, old.growth?.progress);
      if (p.mode === "training") {
        assert(old.build.xp >= cost, "丹田修为不足。");
        p.build.xp = old.build.xp - cost;
        assert(
          cost + (growthData(old).spent[growthData(old).day] ?? 0) <=
            prev.insight * 200 ||
            (isDm && p.override),
          `本次投入 ${cost}，超过每日 ${prev.insight * 200}；跨日训练请由 DM 记录裁定。`,
        );
      } else
        assert(
          isDm || cost === 0,
          "角色成长请选择「修炼并消耗修为」；直接修正由 DM 处理。",
        );
      assert(
        !buildResourceChanges(old, p.build).length || p.acknowledged,
        "请先确认构筑引起的资源上限与架招变化。",
      );
      if (p.mode === "training") {
        const g = clone(growthData(old));
        g.spent[g.day] = (g.spent[g.day] ?? 0) + cost;
        g.records.unshift({
          at: now,
          day: g.day,
          label: "构筑修炼",
          amount: -cost,
          note: "通过成长编辑保存",
        });
        old.growth = g;
      }
      if (old.growth) {
        const learned = [...p.build.inner, ...p.build.moves];
        for (const item of [...old.build.inner, ...old.build.moves]) {
          const nextItem = learned.find((n) => n.id === item.id);
          if (!nextItem || nextItem.level < item.level) {
            const e = getEntry(item.id);
            old.growth.progress[item.id] =
              nextItem && e ? xpCost(e, nextItem.level) : 0;
            old.growth.records.unshift({
              at: now,
              day: old.growth.day,
              label: `${nextItem ? "人工调整阶段" : "遗忘"} · ${e?.name ?? item.id}`,
              amount: 0,
              note: "已投入修为不返还；冲关资格记录保留",
            });
          }
        }
        old.growth.records = old.growth.records.slice(0, 2000);
      }
      old.build = p.build;
      old.runtime.hp = Math.min(old.runtime.hp, next.hpMax);
      old.runtime.mp = Math.min(old.runtime.mp, next.mpMax);
      if (
        before[old.id].build.activeWeapon !== p.build.activeWeapon ||
        !p.build.moves.some((m) => m.id === old.runtime.stance)
      )
        old.runtime.stance = "";
      touch(old);
      log("应用构筑 · " + old.build.name, before, [
        p.mode === "training" ? `消耗修为 ${cost}` : "角色卡修正",
      ]);
    } else {
      assert(c.characters.length < 100, "角色数量达到上限。");
      assert(p.mode === "creation", "新角色须以创建模式保存。");
      c.characters.push({
        id: p.id || crypto.randomUUID(),
        build: p.build,
        runtime: emptyRuntime(p.build),
        dataRevision: DATA_REVISION,
        revision: 1,
      });
    }
  }
  if (cmd.type === "saveInventory") {
    const p = z
      .object({
        id: z.string(),
        revision: z.number().int().nonnegative(),
        inventory: inventorySchema,
      })
      .parse(cmd.payload);
    const ch = char(p.id);
    assert(
      ch.revision === p.revision,
      "行囊已被其他设备更新，请载入最新数量后再保存。",
      409,
    );
    const errors = inventoryIssues({ ...ch.build, inventory: p.inventory });
    assert(!errors.length, errors.join("\n"));
    const before = { [ch.id]: clone(ch) };
    const old = ownedItems(ch.build);
    ch.build.inventory = p.inventory;
    touch(ch);
    const ids = new Set([...old, ...p.inventory].map((x) => x.id));
    const details = [...ids].flatMap((id) => {
      const a = old.find((x) => x.id === id),
        b = p.inventory.find((x) => x.id === id);
      return JSON.stringify(a) === JSON.stringify(b)
        ? []
        : [
            `${inventoryName(b ?? a!)}：${a?.quantity ?? 0} → ${b?.quantity ?? 0}${b?.note ? `；${b.note}` : ""}`,
          ];
    });
    log(
      "调整行囊 · " + ch.build.name,
      before,
      [...details, "本次只调整持有数量与备注；物品效果由 DM 另行结算。"],
      undefined,
      true,
    );
  }
  if (cmd.type === "saveSnapshot") {
    const s = snapshotSchema.parse(cmd.payload);
    assert(
      c.snapshots.length < 200 || c.snapshots.some((x) => x.id === s.id),
      "方案数量达到上限。",
    );
    c.snapshots = c.snapshots.filter((x) => x.id !== s.id);
    c.snapshots.push({ ...s, createdAt: now });
  }
  if (cmd.type === "deleteSnapshot") {
    const p = z.object({ id: z.string() }).parse(cmd.payload);
    c.snapshots = c.snapshots.filter((x) => x.id !== p.id);
  }
  if (cmd.type === "submitAction") {
    const input = actionSchema.parse(cmd.payload);
    const preview = previewAction(c, input);
    assert(!preview.errors.length, preview.errors.join("\n"));
    const a = char(input.actorId);
    assert(c.pending.length < 200, "待确认行动过多。");
    c.pending.push({
      id: cmd.requestId,
      input,
      actorRevision: a.revision,
      targetRevisions: Object.fromEntries(
        input.targets.map((id) => [id, char(id).revision]),
      ),
      submittedBy: cmd.by,
      createdAt: now,
    });
  }
  if (cmd.type === "confirmAction") {
    const p = z
      .object({
        pendingId: z.string().optional(),
        input: actionSchema.optional(),
        acknowledged: z.boolean(),
      })
      .parse(cmd.payload);
    const pending = p.pendingId
      ? c.pending.find((x) => x.id === p.pendingId)
      : undefined;
    assert(!p.pendingId || pending, "该行动已处理或已撤回。", 409);
    const input = p.input ?? pending?.input;
    assert(input, "缺少行动。");
    if (pending) {
      assert(
        char(pending.input.actorId).revision === pending.actorRevision,
        "出招者状态已变化，请重新提交预览。",
        409,
      );
      for (const [id, v] of Object.entries(pending.targetRevisions))
        assert(
          char(id).revision === v,
          "目标状态已变化，请重新提交预览。",
          409,
        );
      assert(
        input.actorId === pending.input.actorId &&
          input.moveId === pending.input.moveId &&
          JSON.stringify(input.targets) ===
            JSON.stringify(pending.input.targets),
        "修正不能更换角色、招式或目标；请重新提交。",
      );
    }
    const result = previewAction(c, input);
    assert(!result.errors.length, result.errors.join("\n"));
    assert(
      (!result.warnings.length &&
        !result.targets.some((t) => t.warnings.length)) ||
        (p.acknowledged && !!input.manualNote.trim()),
      "仍有待处理效果。请核对并填写 DM 处理记录。",
    );
    const a = char(input.actorId);
    const ids = [...new Set([a.id, ...result.targets.map((t) => t.id)])];
    const before = Object.fromEntries(ids.map((id) => [id, clone(char(id))]));
    const anchor = c.encounter.order[c.encounter.turn] ?? a.id;
    a.runtime.mp -= result.actorMp;
    a.runtime.rage -= result.actorRage;
    a.runtime.hp = Math.max(0, a.runtime.hp - result.actorHpLoss);
    if (getEntry(input.moveId)?.fullAction) a.runtime.reaction = false;
    const reaction =
      input.kind === "reaction" || result.move.action === "reaction";
    if (reaction) a.runtime.reaction = false;
    else if (result.move.action === "minor") {
      if (a.runtime.minor) a.runtime.minor = false;
      else a.runtime.main = false;
    } else {
      a.runtime.main = false;
      if (result.move.action === "charge") a.runtime.minor = false;
    }
    if (getEntry(input.moveId)?.parentId)
      a.runtime.usedRoutine = getEntry(input.moveId)!.parentId!;
    changeCondition(a.runtime, "化劲", -input.huajin);
    changeCondition(a.runtime, "引劲", -input.yinjing);
    a.runtime.conditions = a.runtime.conditions.filter(
      (x) => x.name !== "士气",
    );
    if (result.move.type === "架招" && !input.interrupted)
      a.runtime.stance = input.moveId;
    for (const tr of result.targets) {
      const t = char(tr.id);
      const rt = t.runtime;
      const oldStance = rt.stance;
      const ti = activeInner(t.build);
      const shieldBefore = rt.shield;
      rt.hp = Math.max(0, rt.hp - tr.hpDamage - tr.hpLoss);
      rt.mp = Math.max(0, rt.mp - tr.mpLoss);
      rt.shield = Math.max(0, rt.shield - tr.shieldDamage);
      if (tr.broken) {
        rt.stance = "";
        changeCondition(rt, "破防", 1, anchor, 1);
        rt.conditions = rt.conditions.filter((x) => x.name !== "墨舞");
        if (result.move.name === "悬梁刺股") {
          changeCondition(rt, "倒地", 1, anchor);
          changeCondition(rt, "下盘不稳", 1, anchor, 1);
        }
        if (getEntry(a.build.activeWeapon)?.name === "判官笔")
          changeCondition(rt, "目盲/失明", 1, anchor, 1);
      }
      if (!input.interrupted && ti.entry?.name === "太极神功" && ti.level >= 2)
        changeCondition(rt, "化劲", ti.level === 3 ? 2 : 1, anchor, null, 10);
      if (
        tr.hit &&
        tr.ordinary > 0 &&
        ["physical", "internal"].includes(result.move.damageType)
      ) {
        if (!has(rt, "不怒") && a.build.kind !== t.build.kind)
          rt.rage = Math.min(10, rt.rage + 1);
        if (oldStance && !tr.broken) {
          const stance = getEntry(oldStance);
          const level =
            t.build.moves.find((x) => x.id === oldStance)?.level ?? 1;
          if (stance?.name === "金鸡独立")
            changeCondition(rt, "引劲", 1, anchor, null, 2 + level - 1);
          if (stance?.name === "笔诛墨罚")
            changeCondition(rt, "墨舞", level, anchor, null, 5);
        }
        if (result.move.name === "阳重三叠" && tr.ordinary > 0)
          rt.history[a.id + ":" + input.moveId] = true;
      }
      if (rt.hp === 0) {
        rt.stance = "";
        rt.main = false;
        rt.minor = false;
        rt.reaction = false;
        changeCondition(rt, "倒地", has(rt, "倒地") ? 0 : 1, anchor);
      }
      if (tr.hit && tr.hpDamage + tr.shieldDamage > 0)
        rt.conditions = rt.conditions.filter((x) => x.name !== "自闭");
      void shieldBefore;
    }
    const ac = calculateCharacter(a.build, a.runtime);
    a.runtime.mp = Math.min(ac.mpMax, a.runtime.mp + result.actorMpGain);
    a.runtime.rage = Math.min(10, a.runtime.rage + result.actorRageGain);
    ids.forEach((id) => touch(char(id)));
    if (p.pendingId) c.pending = c.pending.filter((x) => x.id !== p.pendingId);
    log(a.build.name + " · " + result.move.name, before, [
      ...result.details,
      ...result.targets.flatMap((t) => [
        char(t.id).build.name,
        ...t.details,
        `扣除气血 ${t.hpDamage + t.hpLoss} / 护体 ${t.shieldDamage} / 内力 ${t.mpLoss}`,
      ]),
      ...(input.manualNote ? ["DM 处理：" + input.manualNote] : []),
    ]);
  }
  if (cmd.type === "rejectAction") {
    const p = z.object({ id: z.string() }).parse(cmd.payload);
    c.pending = c.pending.filter((x) => x.id !== p.id);
  }
  if (cmd.type === "setRuntime") {
    const p = z
      .object({
        id: z.string(),
        revision: z.number(),
        runtime: runtimeSchema,
        note: z.string().min(1).max(2000),
      })
      .parse(cmd.payload);
    const x = char(p.id);
    assert(x.revision === p.revision, "角色状态已更新，请刷新后再修改。", 409);
    const before = { [x.id]: clone(x) };
    const calc = calculateCharacter(x.build, p.runtime);
    assert(
      p.runtime.hp <= calc.hpMax && p.runtime.mp <= calc.mpMax,
      "当前资源不能超过上限；改变上限请修改构筑。",
    );
    if (p.runtime.stance)
      assert(
        x.build.moves.some((m) => m.id === p.runtime.stance) &&
          getEntry(p.runtime.stance)?.moveType === "架招",
        "不能开启未学习的架招。",
      );
    x.runtime = p.runtime;
    touch(x);
    log("状态修正 · " + x.build.name, before, [p.note]);
  }
  if (cmd.type === "switchInner") {
    const p = z
      .object({
        id: z.string(),
        innerId: z.string(),
        revision: z.number(),
        action: z.enum(["main", "reaction"]),
      })
      .parse(cmd.payload);
    const x = char(p.id);
    assert(x.revision === p.revision, "角色卡已更新。", 409);
    assert(
      !p.innerId || x.build.inner.some((i) => i.id === p.innerId),
      "尚未学习该内功。",
    );
    assert(!c.encounter.active || x.runtime[p.action], "所需动作已消耗。");
    assert(
      !c.encounter.active ||
        p.action === "reaction" ||
        c.encounter.order[c.encounter.turn] === x.id,
      "主要动作需要在自己回合消耗。",
    );
    assert(p.innerId !== x.build.activeInner, "该内功已在运行。");
    const before = { [x.id]: clone(x) };
    const prev = calculateCharacter(x.build);
    const full = x.runtime.hp === prev.hpMax && x.runtime.mp === prev.mpMax;
    x.build.activeInner = p.innerId;
    const next = calculateCharacter(x.build);
    x.runtime.hp = full ? next.hpMax : Math.min(x.runtime.hp, next.hpMax);
    x.runtime.mp = full ? next.mpMax : Math.min(x.runtime.mp, next.mpMax);
    x.runtime.rage = 0;
    if (c.encounter.active) x.runtime[p.action] = false;
    touch(x);
    log("切换内功 · " + x.build.name, before, [
      getEntry(p.innerId)?.name ?? "停止运功",
    ]);
  }
  if (cmd.type === "rules") {
    const p = z
      .object({ name: z.string().min(1).max(80), rules: rulesSchema })
      .parse(cmd.payload);
    c.name = p.name;
    c.rules = p.rules;
  }
  if (cmd.type === "encounter") {
    const p = z
      .object({ active: z.boolean(), order: z.array(z.string()).max(100) })
      .parse(cmd.payload);
    assert(!p.active || p.order.length, "请至少选一名参战角色。");
    assert(new Set(p.order).size === p.order.length, "先攻列表不能重复。");
    p.order.forEach(char);
    const eb = clone(c.encounter);
    const before = Object.fromEntries(
      c.characters.map((x) => [x.id, clone(x)]),
    );
    c.encounter = {
      active: p.active,
      order: p.order,
      round: p.active ? 1 : 0,
      turn: 0,
    };
    c.pending = [];
    for (const x of c.characters) {
      x.runtime.rage = 0;
      x.runtime.history = {};
      x.runtime.usedRoutine = "";
      x.runtime.main = x.runtime.hp > 0;
      x.runtime.minor = x.runtime.hp > 0;
      x.runtime.reaction = x.runtime.hp > 0;
      if (!p.active) {
        x.runtime.conditions = x.runtime.conditions.filter((s) =>
          s.note.includes("长期"),
        );
        x.runtime.stance = "";
        x.runtime.shield = 0;
      }
      touch(x);
    }
    log(
      p.active ? "开始战斗" : "结束战斗",
      before,
      [p.order.map((id) => char(id).build.name).join(" → ")],
      eb,
    );
  }
  if (cmd.type === "nextTurn") {
    assert(c.encounter.active, "尚未开始战斗。");
    assert(!c.pending.length, "请先处理待确认行动，再推进回合。");
    const eb = clone(c.encounter);
    const before = Object.fromEntries(
      c.characters.map((x) => [x.id, clone(x)]),
    );
    const old = char(c.encounter.order[c.encounter.turn]);
    const oc = calculateCharacter(old.build, old.runtime);
    if (!has(old.runtime, "禁疗"))
      old.runtime.hp = Math.min(
        oc.hpMax,
        old.runtime.hp + 10 * stack(old.runtime, "养血"),
      );
    if (!has(old.runtime, "气滞"))
      old.runtime.mp = Math.min(
        oc.mpMax,
        old.runtime.mp + 5 * stack(old.runtime, "聚气"),
      );
    old.runtime.mp = Math.max(
      0,
      old.runtime.mp - 5 * stack(old.runtime, "气虚"),
    );
    c.encounter.turn++;
    if (c.encounter.turn >= c.encounter.order.length) {
      c.encounter.turn = 0;
      c.encounter.round++;
    }
    const next = char(c.encounter.order[c.encounter.turn]);
    const changes: string[] = [];
    for (const x of c.characters) {
      x.runtime.conditions = x.runtime.conditions.filter((s) => {
        if (s.remaining !== null && s.anchor === next.id) {
          s.remaining--;
          if (s.remaining <= 0) {
            changes.push(x.build.name + "的 " + s.name + " 结束");
            return false;
          }
        }
        return true;
      });
      touch(x);
    }
    const nr = next.runtime;
    nr.main = nr.minor = nr.reaction = nr.hp > 0;
    nr.usedRoutine = "";
    const nc = calculateCharacter(next.build, nr);
    const bleed = Math.max(
      0,
      10 * stack(nr, "流血") - (nc.skills["凝血"] ?? 0),
    );
    if (bleed) {
      const absorbed = Math.min(nr.shield, bleed);
      nr.shield -= absorbed;
      const remaining = bleed - absorbed;
      const over = Math.max(0, remaining - nr.hp);
      nr.hp = Math.max(0, nr.hp - remaining);
      nr.mp = Math.max(0, nr.mp - over);
      changes.push(`流血 ${bleed}，护体吸收 ${absorbed}`);
    }
    if (nr.hp === 0) {
      nr.mp = Math.max(0, nr.mp - 5);
      nr.main = nr.minor = nr.reaction = false;
      nr.stance = "";
      changes.push("濒死维持扣除 5 内力；危险环境及死亡检定由 DM 处理。");
    }
    log("回合开始 · " + next.build.name, before, changes, eb);
  }
  if (cmd.type === "undo" || cmd.type === "tableUndo") {
    const p = z.object({ id: z.string() }).parse(cmd.payload);
    const event = c.logs.find((x) => x.id === p.id);
    assert(event && !event.undone, "记录不存在或已撤销。");
    if (cmd.type === "tableUndo")
      assert(
        event.table === true && !event.encounterAfter,
        "只能撤销桌边与行囊记录。",
      );
    for (const [id, rev] of Object.entries(event.afterRevisions))
      assert(
        char(id).revision === rev,
        "该角色之后已有操作。请先撤销后续记录，或使用状态修正，避免覆盖新数据。",
        409,
      );
    if (event.encounterAfter)
      assert(
        JSON.stringify(event.encounterAfter) === JSON.stringify(c.encounter),
        "先攻状态已变化，无法直接撤销。",
        409,
      );
    for (const [id, revision] of Object.entries(
      event.moduleAfterRevisions ?? {},
    ))
      assert(
        c.modules?.find((m) => m.id === id)?.revision === revision,
        "该模组之后已有记录，不能覆盖较新的笔记。",
        409,
      );
    for (const [id, before] of Object.entries(event.moduleBefore ?? {})) {
      const revision = c.modules?.find((m) => m.id === id)?.revision ?? 0;
      c.modules = (c.modules ?? []).filter((m) => m.id !== id);
      if (before) c.modules.push({ ...clone(before), revision: revision + 1 });
    }
    for (const [id, before] of Object.entries(event.before)) {
      const current = char(id);
      const restored = clone(before);
      restored.revision = current.revision + 1;
      c.characters = c.characters.map((x) => (x.id === id ? restored : x));
    }
    if (event.encounterBefore) c.encounter = clone(event.encounterBefore);
    event.undone = true;
    if (cmd.type === "undo") c.pending = [];
    // Rebase the nearest previous untouched event for sequential undo; never overwrite newer edits.
    for (const [id] of Object.entries(event.before)) {
      const prior = c.logs
        .slice(c.logs.indexOf(event) + 1)
        .find((l) => !l.undone && l.afterRevisions[id] !== undefined);
      if (prior && prior.afterRevisions[id] === event.before[id].revision)
        prior.afterRevisions[id] = char(id).revision;
    }
  }
  if (cmd.type === "restore") {
    const p = z
      .object({ campaign: campaignSchema, acknowledged: z.literal(true) })
      .parse(cmd.payload);
    for (const x of p.campaign.characters) {
      const issues = buildIssues(x.build, p.campaign.rules);
      assert(!issues.length, `${x.build.name}：${issues.join("；")}`);
      for (const l of [...x.build.inner, ...x.build.moves])
        assert(getEntry(l.id), "存档使用未知资料条目。");
    }
    const ids = p.campaign.characters.map((x) => x.id);
    assert(new Set(ids).size === ids.length, "存档存在重复角色。");
    assert(
      p.campaign.encounter.order.every((id) => ids.includes(id)),
      "先攻包含不存在的角色。",
    );
    c = p.campaign;
    c.receipts = {};
    c.pending = [];
    c.characters.forEach((x) => x.revision++);
  }
  c.receipts[cmd.requestId] = { at: now, result: cmd.type };
  const keys = Object.keys(c.receipts);
  if (keys.length > 2000)
    for (const key of keys.slice(0, keys.length - 2000)) delete c.receipts[key];
  return c;
}
