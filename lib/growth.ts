import { z } from "zod";
import { getEntry, maxRank, xpCost, addEntry } from "./catalog.ts";
import { calculateCharacter, learningIssues } from "./rules.ts";
import type { Character, Rulings } from "./types.ts";
const amount = z.number().int().min(0).max(10000000),
  id = z.string().min(1).max(140);
export const growthSchema = z.object({
  day: z.string().min(1).max(80),
  progress: z.record(amount),
  spent: z.record(amount),
  sources: z.record(id),
  usedInner: z.record(id).optional(),
  attempts: z.record(amount),
  records: z
    .array(
      z.object({
        at: z.string(),
        day: z.string(),
        label: z.string(),
        amount: z.number(),
        note: z.string(),
        meridian: z.object({ entryId: id, innerId: id, attempt: z.number().int(), difficulty: z.number().int(), die: z.number().int(), success: z.boolean() }).optional(),
      }),
    )
    .max(2000),
});
export type Growth = z.infer<typeof growthSchema>;
export const growthData = (ch: Character): Growth =>
  ch.growth ?? {
    day: "第1日",
    progress: {},
    spent: {},
    sources: {},
    attempts: {},
    records: [],
  };
const common = {
  day: z.string().trim().min(1).max(80),
  note: z.string().max(1000).default(""),
};
export const growthOperation = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("invest"),
    ...common,
    entryId: id,
    amount,
    prerequisites: z.literal(true),
  }),
  z.object({ kind: z.literal("gain"), ...common, amount: amount.min(1) }),
  z.object({
    kind: z.literal("meridian"),
    ...common,
    entryId: id,
    innerId: id,
    die: z.number().int().min(1).max(20),
  }),
  z.object({ kind: z.literal("bind"), ...common, entryId: id, innerId: id }),
  z.object({
    kind: z.literal("extraordinary"),
    ...common,
    entryId: id,
    prerequisites: z.literal(true),
  }),
]);
export function trainingProgress(ch: Character, id: string) {
  const e = getEntry(id);
  if (!e) return 0;
  const learned = [...ch.build.inner, ...ch.build.moves].find(
    (x) => x.id === id,
  );
  return Math.max(
    growthData(ch).progress[id] ?? 0,
    learned ? xpCost(e, learned.level) : 0,
  );
}
export function dantianCapacity(ch: Character) {
  return 5000 + ch.build.base.body * 200;
}
export function growthProblems(ch: Character) {
  return ch.build.meridians.filter(
    (id) => getEntry(id)?.grade !== "奇经八脉" && !growthData(ch).sources[id],
  );
}
const assert = (yes: unknown, msg: string) => {
  if (!yes) throw new Error(msg);
};
export function applyGrowth(ch: Character, raw: unknown, rules: Rulings) {
  const op = growthOperation.parse(raw),
    g = structuredClone(growthData(ch)),
    b = ch.build,
    c = calculateCharacter(b);
  let label = "",
    delta = 0;
  let meridian: Growth["records"][number]["meridian"];
  g.usedInner = { ...Object.fromEntries(Object.entries(g.sources).map(([mid, iid]) => [iid, mid])), ...g.usedInner };
  const record = (message: string, n: number) => {
    label = message;
    delta = n;
  };
  if (op.kind === "gain") {
    const boosted = b.inner.some(
      (l) => getEntry(l.id)?.name === "先天诀" && l.level === 3,
    )
      ? Math.floor(op.amount * 1.3)
      : op.amount;
    const accepted = Math.max(0, Math.min(boosted, dantianCapacity(ch) - b.xp));
    b.xp += accepted;
    record(
      `获得修为 ${accepted}${boosted > accepted ? `；超出丹田容量 ${boosted - accepted}` : ""}`,
      accepted,
    );
  } else if (op.kind === "invest") {
    const e = getEntry(op.entryId);
    assert(
      e && ["inner", "move", "special"].includes(e.kind),
      "请选择单门内功或单招",
    );
    if (!e) throw new Error();
    const issues = learningIssues(b, e, rules);
    assert(!issues.length, issues.join("；"));
    const current = trainingProgress(ch, e.id),
      goal = xpCost(e, maxRank(e));
    const freeLearning = op.amount === 0 && xpCost(e, 1) === 0 &&
      ![...b.inner, ...b.moves].some(l => l.id === e.id) &&
      (e.grade === "人级" || !!e.learning);
    assert(op.amount > 0 || freeLearning, "0修为仅用于尚未学会且首阶段免费的功法");
    assert(freeLearning || current < goal, "此功法已完成修炼");
    assert(op.amount <= goal - current, "投入不能超过修满所需");
    assert(b.xp >= op.amount, "丹田修为不足");
    assert(
      (g.spent[op.day] ?? 0) + op.amount <= c.insight * 200,
      `本日已投入 ${g.spent[op.day] ?? 0}，上限 ${c.insight * 200}`,
    );
    g.progress[e.id] = current + op.amount;
    g.spent[op.day] = (g.spent[op.day] ?? 0) + op.amount;
    b.xp -= op.amount;
    let rank = 0;
    for (let i = 1; i <= maxRank(e); i++)
      if (xpCost(e, i) <= g.progress[e.id]) rank = i;
    if (e.music && g.progress[e.id] < e.music.learnCost) rank = 0;
    if (rank) {
      const next = addEntry(b, e, rank);
      ch.build = next;
    }
    record(
      `修炼${e.name}：累计 ${g.progress[e.id]}${rank ? "；已达第" + rank + "阶段" : "；尚未领悟"}`,
      -op.amount,
    );
  } else {
    const e = getEntry(op.entryId);
    assert(e?.kind === "meridian", "经脉不存在");
    if (!e) throw new Error();
    if (op.kind === "extraordinary") {
      assert(e.grade === "奇经八脉", "请选择奇经");
      assert(!b.meridians.includes(e.id), "已打通");
      const issues = learningIssues(b, e, rules).filter(
        (t) => !t.includes("穴位服食奇珍"),
      );
      assert(!issues.length, issues.join("；"));
      b.meridians.push(e.id);
      record(`确认奇经 ${e.name}`, 0);
    } else {
      const inner = getEntry(op.innerId),
        learned = b.inner.find((l) => l.id === op.innerId),
        yin = e.name.includes("阴");
      assert(
        inner?.kind === "inner" &&
          (op.kind === "bind"
            ? !!op.note.trim()
            : learned?.level === maxRank(inner)),
        op.kind === "bind"
          ? "补录历史内功须填写核对依据（可为已遗忘内功）"
          : "需选择已圆满的内功",
      );
      assert(
        inner?.grade ===
          (
            { 第一关: "人级", 第二关: "地级", 第三关: "天级" } as Record<
              string,
              string
            >
          )[e.grade],
        "内功品级与经脉关数不符",
      );
      assert(
        ["太极", yin ? "阴柔" : "阳刚"].includes(inner?.affinity ?? ""),
        "内功属性不符",
      );
      assert(
        !g.usedInner[op.innerId] || g.usedInner[op.innerId] === e.id,
        "这门内功已用于另一条经脉，遗忘重学不会刷新资格",
      );
      if (op.kind === "bind") {
        assert(b.meridians.includes(e.id), "只能补录已有经脉");
        assert(!g.sources[e.id], "此经脉已有来源，补录不能覆盖已使用的冲关资格");
        g.sources[e.id] = op.innerId;
        g.usedInner[op.innerId] = e.id;
        record(`补录${e.name}来源：${inner!.name}`, 0);
      } else {
        assert(!b.meridians.includes(e.id), "已经打通此经脉");
        assert(growthProblems(ch).length === 0, "请先为历史经脉补录内功来源");
        const issues = learningIssues(b, e, rules);
        assert(!issues.length, issues.join("；"));
        assert(b.xp >= 500, "冲关需500修为");
        const dc =
          ({ 第一关: 11, 第二关: 15, 第三关: 19 } as Record<string, number>)[
            e.grade
          ] -
          5 * (g.attempts[e.id] ?? 0);
        b.xp -= 500;
        g.attempts[e.id] = (g.attempts[e.id] ?? 0) + 1;
        meridian = { entryId: e.id, innerId: op.innerId, attempt: g.attempts[e.id], difficulty: dc, die: op.die, success: op.die >= dc };
        if (op.die >= dc) {
          b.meridians.push(e.id);
          g.sources[e.id] = op.innerId;
          g.usedInner[op.innerId] = e.id;
        }
        record(
          `${e.name} · ${inner!.name} · 第${g.attempts[e.id]}次：D20=${op.die}，难度${dc}，${op.die >= dc ? "成功" : "失败，下次难度−5"}`,
          -500,
        );
      }
    }
  }
  g.day = op.day;
  g.records.unshift({
    at: new Date().toISOString(),
    day: op.day,
    label,
    amount: delta,
    note: op.note,
    ...(meridian ? { meridian } : {}),
  });
  g.records = g.records.slice(0, 2000);
  ch.growth = g;
  return label;
}
