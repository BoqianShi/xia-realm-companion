import {
  hostOperationSchema,
  type HostingState,
  type StageBoard,
  type StageUnit,
} from "./hosting-schema.ts";
import { calculateCharacter } from "./rules.ts";
import { getEntry } from "./catalog.ts";
import type { Campaign, Character } from "./types.ts";
import type { ModuleNpc } from "./module-types.ts";
import { effectDescription, stanceReference } from "./table-effects.ts";
import {
  encounterVersion,
  getAdventureEncounter,
  initialEncounterCounts,
  encounterIssues,
  encounterUnits,
} from "./adventure-encounters.ts";
export * from "./hosting-schema.ts";
export const blankBoard = (title = "新的遭遇"): StageBoard => ({
  title,
  status: "setup",
  round: 0,
  activeId: null,
  units: [],
});
export function emptyHosting(): HostingState {
  return {
    revision: 0,
    session: { title: "本次跑团", date: "", outline: "", notes: "", recap: "" },
    scenes: [],
    activeSceneId: null,
    board: blankBoard(),
    presets: [],
    archives: [],
    history: [],
    screen: {
      mode: "standby",
      title: "",
      text: "",
      image: "",
      publishedAt: "",
      sceneId: "",
    },
  };
}
export const blankUnit = (): StageUnit => ({
  id: crypto.randomUUID(),
  name: "临时人物",
  side: "enemy",
  characterId: "",
  moduleId: "",
  npcId: "",
  score: null,
  bonus: null,
  die: null,
  out: false,
  hidden: false,
  publicName: "",
  hp: null,
  hpMax: null,
  mp: null,
  mpMax: null,
  healthLabel: "气血",
  conditions: "",
  note: "",
});
export function characterUnit(c: Character): StageUnit {
  return {
    ...blankUnit(),
    name: c.build.name,
    side: c.build.kind === "pc" ? "player" : "ally",
    characterId: c.id,
    bonus: calculateCharacter(c.build).initiative,
  };
}
export function npcUnit(moduleId: string, npc: ModuleNpc): StageUnit {
  const number = (keys: string[]) => {
    const f = npc.fields.find((f) => keys.includes(f.label));
    return f && /^[-+]?\d+$/.test(f.value.trim()) ? Number(f.value) : null;
  };
  const beast = npc.kind === "beast";
  const hp = number(beast ? ["体力"] : ["气血上限", "气血"]),
    mp = number(["内力上限", "内力"]);
  return {
    ...blankUnit(),
    name: npc.name,
    moduleId,
    npcId: npc.id,
    bonus: number(["先攻", "先攻加值"]),
    healthLabel: beast ? "体力" : "气血",
    hp,
    hpMax: hp,
    mp,
    mpMax: mp,
  };
}
export class HostError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
function requireHost(yes: unknown, message: string, status = 400): asserts yes {
  if (!yes) throw new HostError(message, status);
}
export function nextUnit(board: StageBoard) {
  const at = board.units.findIndex((u) => u.id === board.activeId);
  for (let step = 1; step <= board.units.length; step++) {
    const i = (at + step + board.units.length) % board.units.length;
    if (
      !board.units[i].out &&
      !board.units[i].reserve &&
      !board.units[i].offstage
    )
      return { unit: board.units[i], wrapped: i <= at };
  }
  return null;
}
export function initiativeBonus(c: Campaign, u: StageUnit): number | null {
  if (!u.characterId) return u.bonus;
  const ch = c.characters.find((ch) => ch.id === u.characterId);
  return ch ? calculateCharacter(ch.build).initiative : null;
}
export function rollInitiativeDie(): number {
  const buffer = new Uint32Array(1);
  // Reject the incomplete final bucket so all twenty faces are equally likely.
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= 4294967280);
  return buffer[0] % 20 + 1;
}
function sortInitiative(b: StageBoard) {
  b.units = b.units
    .map((u, i) => ({ u, i }))
    .sort((a, z) => (z.u.score ?? -Infinity) - (a.u.score ?? -Infinity) || a.i - z.i)
    .map((x) => x.u);
}
export function applyHost(
  c: Campaign,
  raw: { revision: number; operation: unknown },
  dm: boolean,
): HostingState {
  const h = structuredClone(c.hosting ?? emptyHosting()),
    op = hostOperationSchema.parse(raw.operation),
    b = h.board,
    now = new Date().toISOString();
  requireHost(
    raw.revision === h.revision,
    "主持台已有更新，输入已保留；请核对最新记录后再保存。",
    409,
  );
  requireHost(
    dm || op.kind === "roll" || op.kind === "autoRoll" || op.kind === "tone",
    "请切换到主持人视图。",
    403,
  );
  const context = () =>
    structuredClone({
      session: h.session,
      sessions: h.sessions,
      activeSessionId: h.activeSessionId,
      journal: h.journal,
      pins: h.pins,
    });
  const contextBefore = context();
  const contextLabels: Record<string, string> = {
    session: "编辑场次",
    sessionNew: "新建场次",
    sessionSelect: "切换场次",
    journal: "保存关联速记",
    pin: "固定资料",
  };
  const unit = (id: string) => {
    const u = b.units.find((u) => u.id === id);
    if (!u) throw new HostError("行动单位已不存在。", 404);
    return u;
  };
  const record = (label: string) => {
    h.history.unshift({
      id: crypto.randomUUID(),
      label,
      at: now,
      board: structuredClone(b),
    });
    h.history = h.history.slice(0, 20);
  };
  const validateUnits = (units: StageUnit[]) => {
    requireHost(units.length <= 60, "每场最多 60 个行动单位。");
    requireHost(
      new Set(units.map((u) => u.id)).size === units.length,
      "行动单位重复。",
    );
    const linked = units.filter((u) => u.characterId).map((u) => u.characterId);
    requireHost(new Set(linked).size === linked.length, "同一角色已经加入。");
    requireHost(
      linked.every((id) => c.characters.some((ch) => ch.id === id)),
      "关联角色不存在，请重新选择。",
    );
    for (const u of units)
      requireHost(!u.portraitId || !!c.portraits?.[u.portraitId], "头像资料缺失，请重新上传。");
    for (const u of units)
      for (const [current, max] of [
        [u.hp, u.hpMax],
        [u.mp, u.mpMax],
      ])
        requireHost(
          current === null || max === null || current <= max,
          "当前资源不能超过上限。",
        );
  };
  const replaceBoard = (board: StageBoard) => {
    requireHost(
      !["running", "paused"].includes(b.status),
      "请先结束当前遭遇，再创建或载入另一场。",
    );
    if (b.units.length) {
      h.archives.unshift({
        id: crypto.randomUUID(),
        at: now,
        board: structuredClone(b),
      });
      h.archives = h.archives.slice(0, 10);
    }
    h.board = board;
    h.history = [];
  };
  const advance = () => {
    const next = nextUnit(b);
    if (!next) {
      b.status = "paused";
      b.activeId = null;
    } else {
      b.activeId = next.unit.id;
      if (next.wrapped && b.trackingMode === "turn") b.round++;
    }
  };
  switch (op.kind) {
    case "session":
      requireHost(!op.sessionId || op.sessionId === (h.activeSessionId ?? "legacy-session"), "当前场次已切换，请返回原场次保存这份草稿。");
      h.session = op.value;
      if (h.sessions)
        h.sessions = h.sessions.map((s) =>
          s.id === h.activeSessionId ? { ...op.value, id: s.id } : s,
        );
      break;
    case "sessionNew":
    case "sessionSelect": {
      h.activeSessionId ??= "legacy-session";
      h.sessions ??= [{ ...h.session, id: h.activeSessionId }];
      h.sessions = h.sessions.map((s) =>
        s.id === h.activeSessionId ? { ...h.session, id: s.id } : s,
      );
      if (op.kind === "sessionNew") {
        requireHost(h.sessions.length < 300, "场次已达上限，请先导出归档。");
        const s = {
          id: crypto.randomUUID(),
          title: op.title,
          date: op.date,
          outline: "",
          notes: "",
          recap: "",
        };
        h.sessions.push(s);
        h.activeSessionId = s.id;
        h.session = s;
      } else {
        const s = h.sessions.find((s) => s.id === op.id);
        requireHost(s, "场次不存在");
        h.activeSessionId = s!.id;
        h.session = s!;
      }
      break;
    }
    case "journal": {
      h.journal ??= [];
      const i = h.journal.findIndex((n) => n.id === op.value.id);
      requireHost(
        op.value.sessionId === (h.activeSessionId ?? "legacy-session") ||
          (h.sessions ?? []).some((s) => s.id === op.value.sessionId),
        "场次不存在",
      );
      requireHost(
        i >= 0 || h.journal.length < 2000,
        "笔记已达上限，请先导出归档。",
      );
      if (i < 0) h.journal.unshift({ ...op.value, at: now });
      else h.journal[i] = { ...op.value, at: h.journal[i].at };
      break;
    }
    case "pin": {
      h.pins ??= [];
      const key = (r: typeof op.value) =>
        r.kind + ":" + r.id + ":" + (r.moduleId ?? "");
      if (h.pins.some((p) => key(p) === key(op.value)))
        h.pins = h.pins.filter((p) => key(p) !== key(op.value));
      else {
        requireHost(h.pins.length < 30, "最多固定30张卡");
        h.pins.push(op.value);
      }
      break;
    }
    case "tone": {
      h.tones ??= [];
      h.toneHistory ??= [];
      if (op.value === "撤销") {
        requireHost(h.toneHistory.length, "没有可撤销的音阶记录");
        h.tones = h.toneHistory.pop()!;
      } else {
        h.toneHistory.push([...h.tones]);
        h.toneHistory = h.toneHistory.slice(-30);
        h.tones = op.value === "清空" ? [] : [...h.tones, op.value].slice(-5);
      }
      break;
    }
    case "recoverOrder": {
      requireHost(
        b.activeId && b.activeId !== op.id,
        "请选择当前行动者之外的获救角色",
      );
      const u = unit(op.id);
      record("获救后调整先攻");
      b.units = b.units.filter((x) => x.id !== u.id);
      const at = b.units.findIndex((x) => x.id === b.activeId);
      b.units.splice(at + 1, 0, u);
      u.out = false;
      u.reserve = false;
      u.offstage = false;
      break;
    }
    case "scene": {
      const i = h.scenes.findIndex((s) => s.id === op.value.id);
      requireHost(
        i >= 0 || h.scenes.length < 100,
        "最多保存 100 个场景与线索。",
      );
      if (i < 0) h.scenes.push(op.value);
      else h.scenes[i] = op.value;
      if (op.value.archived && h.activeSceneId === op.value.id)
        h.activeSceneId = null;
      break;
    }
    case "activeScene":
      requireHost(
        h.scenes.some((s) => s.id === op.id && !s.archived),
        "场景不存在或已归档。",
      );
      h.activeSceneId = op.id;
      break;
    case "publish": {
      const scene = h.scenes.find((s) => s.id === op.sceneId);
      if (op.mode === "text" || op.mode === "image") {
        requireHost(scene && !scene.archived, "请选择一个未归档的场景或线索。");
        requireHost(
          op.mode === "image" ? !!scene!.image : !!scene!.text.trim(),
          "这个场景还没有相应内容。",
        );
      }
      h.screen = {
        mode: op.mode,
        title: scene?.title ?? "",
        text: op.mode === "text" ? scene!.text : "",
        image: op.mode === "image" ? scene!.image : "",
        publishedAt: now,
        sceneId: scene?.id ?? "",
      };
      break;
    }
    case "add":
      validateUnits([...b.units, ...op.units]);
      record("加入行动单位");
      b.units.push(...op.units);
      break;
    case "edit": {
      const old = unit(op.unit.id);
      requireHost(
        old.characterId === op.unit.characterId &&
          old.moduleId === op.unit.moduleId &&
          old.npcId === op.unit.npcId,
        "人物来源不能在现场编辑中替换。",
      );
      validateUnits(b.units.map((u) => (u.id === old.id ? op.unit : u)));
      requireHost(old.out === op.unit.out, "请使用退场按钮改变出场状态。");
      requireHost(
        old.reserve === op.unit.reserve &&
          old.offstage === op.unit.offstage &&
          old.scriptActorId === op.unit.scriptActorId,
        "请使用入场按钮改变候场状态。",
      );
      record("修改 · " + old.name);
      b.units = b.units.map((u) => (u.id === old.id ? op.unit : u));
      break;
    }
    case "rollAll": {
      requireHost(b.status === "setup", "先攻已开始；只可为新入场人物掷骰，不能重排全场。");
      const eligible = b.units.filter((u) => !u.out && !u.reserve && !u.offstage &&
        (op.reroll || u.score === null) && initiativeBonus(c, u) !== null);
      requireHost(eligible.length, "没有待掷骰的人物；若有缺项，请先补充先攻加值。");
      record(`${op.reroll ? "重掷" : "自动掷"}先攻并排序 · ${eligible.length} 位`);
      for (const u of eligible) {
        u.bonus = initiativeBonus(c, u)!;
        u.die = rollInitiativeDie();
        u.score = u.die + u.bonus;
      }
      sortInitiative(b);
      break;
    }
    case "autoRoll": {
      const u = unit(op.id);
      requireHost(b.status !== "ended" && !u.out && !u.offstage, "这位人物当前不参与先攻。");
      if (!dm) {
        requireHost(b.status === "setup" && !u.reserve, "先攻已开始，请由主持人处理入场。");
        requireHost(!!u.characterId && u.characterId === op.characterId, "请选择对应角色。");
      }
      requireHost(u.score === null, "已经掷过先攻，结果已保留；如需重掷，请由主持人调整。");
      const bonus = initiativeBonus(c, u);
      requireHost(bonus !== null, "请先补充这位人物的先攻加值。");
      record("自动掷先攻 · " + u.name);
      u.bonus = bonus;
      u.die = rollInitiativeDie();
      u.score = u.die + bonus;
      if (b.status === "setup") sortInitiative(b);
      break;
    }
    case "roll": {
      requireHost(b.status === "setup", "先攻已开始，请由主持人调整。");
      const u = unit(op.id);
      requireHost(u.characterId === op.characterId, "请选择对应角色。");
      const ch = c.characters.find((ch) => ch.id === op.characterId);
      requireHost(ch, "角色不存在。");
      record("填写先攻 · " + u.name);
      u.die = op.die;
      u.bonus = calculateCharacter(ch!.build).initiative;
      u.score = op.die + u.bonus;
      break;
    }
    case "sort":
      record("按先攻排序");
      sortInitiative(b);
      break;
    case "move": {
      const i = b.units.findIndex((u) => u.id === op.id);
      unit(op.id);
      const j = i + (op.direction === "up" ? -1 : 1);
      requireHost(j >= 0 && j < b.units.length, "已在队列边缘。");
      record("调整行动顺序");
      [b.units[i], b.units[j]] = [b.units[j], b.units[i]];
      break;
    }
    case "out": {
      const u = unit(op.id);
      record(op.out ? "标记退场" : "恢复出场");
      u.out = op.out;
      if (op.out && b.activeId === u.id) advance();
      break;
    }
    case "remove": {
      unit(op.id);
      record("移除行动单位");
      if (b.activeId === op.id) {
        unit(op.id).out = true;
        advance();
      }
      b.units = b.units.filter((u) => u.id !== op.id);
      break;
    }
    case "start": {
      requireHost(b.status === "setup", "当前不在准备阶段。");
      const active = b.units.filter((u) => !u.out && !u.reserve && !u.offstage);
      requireHost(active.length, "请先加入行动单位。");
      requireHost(
        active.every((u) => u.score !== null),
        "请先自动掷先攻；缺少加值的人物可点编辑补充。",
      );
      record("开始遭遇");
      b.status = "running";
      b.round = 1;
      b.activeId = active[0].id;
      break;
    }
    case "next":
      requireHost(b.status === "running", "请先开始或继续遭遇。");
      record("推进到下一位");
      b.trackingMode = "turn";
      advance();
      break;
    case "nextRound": {
      requireHost(b.status === "running", "请先开始或继续遭遇。");
      const first = b.units.find((u) => !u.out && !u.reserve && !u.offstage);
      requireHost(first, "没有仍在场的行动单位。");
      requireHost(b.round < 100000, "轮数已达上限。");
      record(`进入第 ${b.round + 1} 轮`);
      b.round++;
      b.activeId = first!.id;
      break;
    }
    case "setActive": {
      requireHost(["running", "paused"].includes(b.status), "请先开始遭遇。");
      const u = unit(op.id);
      requireHost(!u.out && !u.reserve && !u.offstage, "只能选择仍在场的人物。");
      record("轮到 · " + u.name);
      b.activeId = u.id;
      b.trackingMode = "turn";
      break;
    }
    case "trackingMode":
      record(op.mode === "round" ? "切换为整轮记录" : "切换为逐位记录");
      b.trackingMode = op.mode;
      break;
    case "pause":
      requireHost(b.status === "running", "当前没有进行中的遭遇。");
      record("暂停遭遇");
      b.status = "paused";
      break;
    case "resume":
      requireHost(b.status === "paused", "当前没有暂停的遭遇。");
      requireHost(
        b.units.some((u) => !u.out && !u.reserve && !u.offstage),
        "没有仍在场的行动单位。",
      );
      record("继续遭遇");
      b.activeId ??= b.units.find(
        (u) => !u.out && !u.reserve && !u.offstage,
      )!.id;
      b.round = Math.max(1, b.round);
      b.status = "running";
      break;
    case "end":
      requireHost(b.status !== "ended", "这场遭遇已经结束。");
      record("结束遭遇");
      b.status = "ended";
      b.activeId = null;
      break;
    case "undo": {
      const prior = h.history.shift();
      requireHost(prior, "没有可撤销的先攻操作。");
      h.board = prior!.board;
      break;
    }
    case "new":
      replaceBoard(blankBoard(op.title));
      break;
    case "presetSave":
      requireHost(b.units.length, "先加入单位，再保存阵容。");
      requireHost(h.presets.length < 200, "最多保存 200 个遭遇预设。");
      h.presets.push({
        id: crypto.randomUUID(),
        name: op.name,
        units: b.units.map((u) => ({
          ...u,
          score: null,
          die: null,
          out: false,
          hp: u.hpMax,
          mp: u.mpMax,
          conditions: "",
        })),
      });
      break;
    case "presetLoad": {
      const p = h.presets.find((p) => p.id === op.id);
      requireHost(p, "预设不存在。");
      requireHost(!p!.sourceId, "请通过剧本遭遇核对阵容后载入。");
      const units = p!.units.map((u) => ({
        ...structuredClone(u),
        id: crypto.randomUUID(),
      }));
      validateUnits(units);
      replaceBoard({ ...blankBoard(p!.name), units });
      break;
    }
    case "scriptImport": {
      const entries = [...new Set(op.ids)].map((id) =>
        getAdventureEncounter(id),
      );
      requireHost(entries.every(Boolean), "遭遇来源不存在，请刷新资料。");
      for (const e of entries) {
        if (h.presets.some((p) => p.sourceId === e!.id)) continue;
        requireHost(h.presets.length < 200, "最多保存 200 个遭遇预设。");
        h.presets.push({
          id: `script:${e!.id}`,
          name: e!.title,
          sourceId: e!.id,
          sourceVersion: encounterVersion,
          units: encounterUnits(e!, initialEncounterCounts(e!)),
        });
      }
      break;
    }
    case "scriptLoad": {
      const e = getAdventureEncounter(op.id);
      requireHost(e, "遭遇资料不存在。");
      requireHost(
        h.presets.some((p) => p.sourceId === e!.id),
        "请先导入这场剧本遭遇。",
      );
      const issues = encounterIssues(e!, op.counts);
      requireHost(!issues.length, issues.join(" "));
      requireHost(
        new Set(op.characterIds).size === op.characterIds.length,
        "参战角色重复。",
      );
      const pcs = op.characterIds.map((id) =>
        c.characters.find((ch) => ch.id === id),
      );
      requireHost(pcs.every(Boolean), "参战角色已不存在，请重新选择。");
      const units = [
        ...pcs.map((ch) => characterUnit(ch!)),
        ...encounterUnits(e!, op.counts),
      ];
      validateUnits(units);
      replaceBoard({
        ...blankBoard(e!.title),
        units,
        scriptId: e!.id,
        scriptVersion: encounterVersion,
      });
      break;
    }
    case "enter": {
      const u = unit(op.id);
      requireHost(u.reserve && !u.out, "这位人物不在候场。");
      const bonus = initiativeBonus(c, u);
      requireHost(u.score !== null || bonus !== null, "请先为援军补充先攻加值，再让其入场。");
      requireHost(b.status !== "ended", "本场已结束。");
      record("援军入场 · " + u.name);
      if (u.score === null) {
        u.bonus = bonus!;
        u.die = rollInitiativeDie();
        u.score = u.die + bonus!;
      }
      u.reserve = false;
      if (b.status === "setup") sortInitiative(b);
      break;
    }
    case "scriptWave": {
      const e = getAdventureEncounter(b.scriptId ?? ""),
        actor = e?.cast.find((a) => a.id === op.actorId);
      requireHost(e && actor?.role === "reserve", "这场没有此援军组。");
      requireHost(
        e!.id === "biaoxing-ambush",
        "只有原文明确可重复的援军才能再次补入。",
      );
      requireHost(b.status !== "ended", "本场已结束。");
      const units = encounterUnits(e!, { [actor!.id]: actor!.count });
      const existing = b.units.filter((u) => u.npcId === actor!.npcId).length;
      units.forEach((u, i) => {
        u.name = `${actor!.name} · 援军 ${existing + i + 1}`;
      });
      validateUnits([...b.units, ...units]);
      record("补入下一波候场援军");
      b.units.push(...units);
      break;
    }
  }
  if (op.kind === "contextUndo") {
    const prior = h.contextHistory?.[0];
    requireHost(prior, "没有可撤销的场次或关联操作");
    requireHost(
      JSON.stringify(context()) === JSON.stringify(prior.after),
      "这些记录已被后续修改，不能覆盖；请编辑对应记录。",
      409,
    );
    Object.assign(h, prior.before);
    h.sessions = prior.before.sessions;
    h.activeSessionId = prior.before.activeSessionId;
    h.journal = prior.before.journal;
    h.pins = prior.before.pins;
    h.contextHistory!.shift();
  } else if (contextLabels[op.kind]) {
    h.contextHistory ??= [];
    h.contextHistory.unshift({
      id: crypto.randomUUID(),
      label: contextLabels[op.kind],
      at: now,
      before: contextBefore,
      after: context(),
    });
    h.contextHistory = h.contextHistory.slice(0, 20);
  }
  h.revision++;
  return h;
}
export function visibleUnit(c: Campaign, u: StageUnit) {
  const ch = c.characters.find((ch) => ch.id === u.characterId),
    stats = ch ? calculateCharacter(ch.build) : null;
  return {
    ...u,
    portraitId: ch?.portraitId ?? u.portraitId,
    name: ch?.build.name ?? u.name,
    hp: ch?.runtime.hp ?? u.hp,
    hpMax: stats?.hpMax ?? u.hpMax,
    mp: ch?.runtime.mp ?? u.mp,
    mpMax: stats?.mpMax ?? u.mpMax,
    conditions: ch
      ? ch.runtime.conditions
          .map(
            (s) =>
              `${s.name}${s.stacks > 1 ? ` ×${s.stacks}` : ""}${s.remaining ? ` · ${s.remaining}回合` : ""}`,
          )
          .join("；")
      : u.conditions,
  };
}
export function screenProjection(c: Campaign) {
  const h = c.hosting ?? emptyHosting(),
    b = h.board,
    visible = b.units.filter((u) => !u.hidden && !u.reserve && !u.offstage),
    active = visible.find((u) => u.id === b.activeId),
    next = nextUnit(b)?.unit;
  return {
    campaign: c.name,
    mode: h.screen.mode,
    title: h.screen.title,
    text: h.screen.mode === "text" ? h.screen.text : "",
    image: h.screen.mode === "image" ? h.screen.image : "",
    publishedAt: h.screen.publishedAt,
    board: {
      title: b.title,
      status: b.status,
      round: b.round,
      trackingMode: b.trackingMode ?? "round",
      activeId: b.trackingMode === "turn" ? active?.id ?? null : null,
      nextId: b.trackingMode === "turn" && next && !next.hidden ? next.id : null,
      units: visible.map((u) => {
        const v = visibleUnit(c, u),
          showDetails = u.screenDetails ?? (u.side === "player"),
          ch = showDetails ? c.characters.find((ch) => ch.id === u.characterId) : undefined,
          stance = ch
            ? stanceReference(ch.build, ch.runtime.stance, c.rules)
            : showDetails && u.activeTechnique ? {
                name: u.activeTechnique, block: null,
                summary: effectDescription({ name: u.activeTechnique, effect: u.activeTechniqueEffect })?.text ?? "请在先攻编辑中补充挂招效果。",
                details: [] as string[], meta: "", entryId: "",
              } : null;
        return {
          id: u.id,
          name: u.publicName || v.name,
          portrait: c.portraits?.[v.portraitId ?? ""] ?? "",
          score: u.score,
          side: u.side,
          out: u.out,
          healthLabel: v.healthLabel,
          showDetails,
          hp: showDetails ? v.hp : null,
          hpMax: showDetails ? v.hpMax : null,
          mp: showDetails ? v.mp : null,
          mpMax: showDetails ? v.mpMax : null,
          rage: showDetails ? ch?.runtime.rage ?? u.rage ?? null : null,
          shield: showDetails ? ch?.runtime.shield ?? u.shield ?? null : null,
          stance,
          inner: ch ? getEntry(ch.build.activeInner)?.name ?? "" : "",
          conditions: showDetails ? v.conditions : "",
          statuses: ch ? ch.runtime.conditions.map((s) => ({
            id: s.id, name: s.name, stacks: s.stacks, remaining: s.remaining, anchor: s.anchor,
            effect: effectDescription(s),
          })) : [],
          counters: ch ? (ch.table?.counters ?? []).map((counter) => ({
            id: counter.id, name: counter.name, value: counter.value,
            effect: effectDescription(counter),
          })) : [],
        };
      }),
    },
  };
}
export type ScreenProjection = ReturnType<typeof screenProjection>;
