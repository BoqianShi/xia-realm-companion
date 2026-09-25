import { DATA_REVISION, effectiveMoves, getEntry, inventoryName, ownedItems, rankLabel, sourceLabel, maxRank } from "./catalog.ts";
import { activeInner, calculateCharacter, calculateMove, defaultRules, weaponBonus } from "./rules.ts";
import { groupMoves } from "./move-book.ts";
import { movePresentation } from "./move-presentation.ts";
import { previewMove } from "./move-preview.ts";
import { moveReference, damageNames, equipmentReference } from "./reference-presentation.ts";
import { skillCheck, tableData } from "./tabletop.ts";
import { ruleNotes, noteLabels } from "./rule-notes.ts";
import { ruleTopics } from "./rule-guide.ts";
import { characterPrintStyle } from "./character-print-style.ts";
import { STAT_KEYS, STAT_NAMES, RULES_VERSION, type Character, type Rulings } from "./types.ts";

export type PrintOptions = { notes?: boolean; fullRules?: boolean; guide?: boolean; handwriting?: boolean };
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const paragraph = (s: unknown) => `<p>${esc(s)}</p>`;
const table = (headers: string[], rows: unknown[][], cls = "") => `<table class="${esc(cls)}"><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const section = (title: string, content: string, cls = "") => `<section class="${esc(cls)}"><h2>${esc(title)}</h2>${content}</section>`;
const field = (label: string, value = "") => `<div class="field"><label>${esc(label)}</label><strong>${esc(value) || "&nbsp;"}</strong></div>`;
const ruled = (lines: number) => Array.from({ length: lines }, () => '<div class="ruled-line"></div>').join("");
const blankRows = (columns: number, count: number) => Array.from({ length: count }, () => Array(columns).fill(""));
const signed = (v: number) => v < 0 ? String(v) : `＋${v}`;
const check = (v: number) => `D20${signed(v)}`;
// The books' extraction wraps mid-sentence. Reflow those lines while retaining
// metadata, complete sentences and upgrade clauses as distinct paragraphs.
const originalText = (text: string) => {
  const blocks: { kind: string; text: string }[] = [];
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line) continue;
    const kind = i === 0 ? "title" : /^(类型|距离|消耗|需求)\s*[:：]/.test(line) ? "meta" : "body";
    const last = blocks.at(-1);
    if (last?.kind === "meta" && kind === "meta") last.text += "　" + line;
    else if (last?.kind === "body" && kind === "body" && !/[。！？]$/.test(last.text) && !/^(升级\s*[:：]|[·•])/.test(line)) last.text += line;
    else blocks.push({ kind, text: line });
  }
  return blocks.map(x => paragraph(x.text)).join("");
};

export function characterPrintHtml(ch: Character, rules: Rulings = defaultRules, options: PrintOptions = {}, at = new Date()) {
  const b = ch.build, c = calculateCharacter(b), t = tableData(ch), active = activeInner(b);
  const date = at.toLocaleDateString("zh-CN");
  const chapter = (title: string, subtitle: string, content: string, cls = "") => `<section class="chapter ${cls}"><header class="chapter-head"><div><div class="kicker">侠界之旅 · 线下人物卡</div><h1>${esc(title)}</h1></div><div class="aside"><b>${esc(b.name)}</b><br>${esc(subtitle)}</div></header>${content}</section>`;
  const notesHtml = (items: string[], entry?: ReturnType<typeof getEntry>, hideShared = false) => ruleNotes(items, { entry, hideShared }).map(n => `<p class="note"><b>${noteLabels[n.kind]}：</b>${esc(n.text)}</p>`).join("");
  const stance = effectiveMoves(b).find(x => x.id === ch.runtime.stance);
  const stanceMove = stance ? calculateMove(b, stance.id, stance.level, rules) : undefined;
  const resource = (name: string, value: number, max?: number) => `<div class="resource"><small>${name}</small><div class="value">${value}${max !== undefined ? `<small> / ${max}</small>` : ""}</div><span class="pencil"><span>现值</span></span></div>`;
  const resources = `<div class="resources">${resource("气血 · 当前 / 上限", ch.runtime.hp, c.hpMax)}${resource("内力 · 当前 / 上限", ch.runtime.mp, c.mpMax)}${resource("怒气 · 当前 / 上限", ch.runtime.rage, 10)}${resource("护体真气", ch.runtime.shield)}</div>`;
  const innerStats = active.entry?.stages?.find(s => s.stage === active.level)?.stats;
  const stats = table(["属性来源", ...STAT_KEYS.map(k => STAT_NAMES[k])], [
    ["基础与自由属性", ...STAT_KEYS.map(k => b.base[k] + (b.freeAttributes?.[k] ?? 0))],
    ["当前运行内功", ...STAT_KEYS.map(k => innerStats ? signed(innerStats[k]) : active.entry ? "未列" : "—")],
    ["其余加成（永久 / 装备等）", ...STAT_KEYS.map(k => signed(c.stats[k] - b.base[k] - (b.freeAttributes?.[k] ?? 0) - (innerStats?.[k] ?? 0)))],
    ["当前合计", ...STAT_KEYS.map(k => c.stats[k])],
  ], "stat-matrix");
  const metrics: [string, string | number][] = [
    ["外功命中", check(c.physicalHit)], ["内功命中", check(c.internalHit)], ["外功防御", c.physicalDefense], ["内功防御", c.internalDefense],
    ["外功暴击门槛", c.physicalCrit], ["内功暴击门槛", c.internalCrit], ["闪避", c.dodge], ["速度", `${c.speed} 米`],
    ["先攻", check(c.initiative)], ["看破", check(c.lookThrough)], ["悟性", c.insight], ["当前架招 · 基础格挡", stanceMove ? stanceMove.block : "未开启"],
  ];
  const panel = `<div class="metrics">${metrics.map(([k, v]) => `<div class="metric"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`;

  // Group by the catalog's attribute, retaining unusual/craft skills in their own group.
  const checks = Object.entries(c.skills).map(([name, level]) => ({ name, level, ...skillCheck(b, name) }));
  const skillGroups = new Map<string, typeof checks>();
  for (const s of checks) {
    const group = s.entry?.grade || "其他技艺";
    skillGroups.set(group, [...(skillGroups.get(group) ?? []), s]);
  }
  const skillCards = [...skillGroups].map(([name, values]) => `<div class="skill-box"><h3>${esc(name)}</h3>${table(["技能", "等级", "检定"], values.map(s => [s.name, s.level, `${check(s.value)}${s.conditional.length ? " *" : ""}`]))}</div>`).join("");
  const weapons = Object.entries(c.weaponSkills);
  const weaponCards = [weapons.slice(0, 4), weapons.slice(4)].filter(x => x.length).map((items, i) => `<div class="skill-box"><h3>武器技能${i ? "（续）" : ""}</h3>${table(["武器", "等级", "伤害加值"], items.map(([name, level]) => [name, level, signed(weaponBonus(level, rules))]), "weapon")}</div>`).join("");
  const overview = chapter("人物总览", `${date} · 已保存修订 ${ch.revision}`, `<div class="identity">${field("门派", b.sect || "未选择")}${field("背景", getEntry(b.background)?.name || "未选择")}${field("性格", getEntry(b.personality)?.name || "未选择")}${field("实力 / 剩余修为", `${c.realm} / ${b.xp}`)}</div>${resources}${section("人物属性", stats)}${section("桌边常用数值", panel)}<p class="loadout">运行内功：<b>${esc(active.entry?.name ?? "未运行")}</b>　持握武器：<b>${esc(getEntry(b.activeWeapon)?.name ?? "徒手")}</b><br>当前架招：${esc(stanceMove?.name ?? (ch.runtime.stance ? "记录未匹配，请查桌边状态" : "未开启"))}　状态 ${ch.runtime.conditions.length} 项 · 计数器 ${t.counters.length} 项（详见后页）</p>${section("桌边临时记录", ruled(6))}`);

  const inners = b.inner.map(l => {
    const e = getEntry(l.id);
    if (!e) return paragraph(`资料暂缺：${l.id}，保留第 ${l.level} 阶学习记录。`);
    const stage = e.stages?.find(s => s.stage === l.level);
    return `<article class="entry inner-entry"><h3>${esc(e.name)} <span class="tag">${esc(e.grade)} · ${esc(rankLabel(e, l.level))}</span><span class="tag">${b.activeInner === e.id ? "正在运行" : "未运行"}</span></h3>${stage ? table(STAT_KEYS.map(k => STAT_NAMES[k]), [STAT_KEYS.map(k => signed(stage.stats[k]))], "inner-stats") : ""}${paragraph(`${b.activeInner === e.id ? "当前运功" : "运功效果（未生效）"}：${(e.effects?.[String(l.level)] ?? "此阶段未列运功特效").replace(/\n/g, "")}`)}${e.permanent ? paragraph(`${l.level === maxRank(e) ? "修满永久（已获得）" : "修满后永久（尚未获得）"}：${e.permanent.replace(/\n/g, "")}`) : ""}<small>${esc(sourceLabel(e))}</small></article>`;
  }).join("");
  const meridians = b.meridians.length ? table(["已通经脉", "效果", "冲关来源"], b.meridians.map(id => {
    const e = getEntry(id), source = ch.growth?.sources[id];
    return [e?.name ?? id, e?.text ?? "资料暂缺", source ? getEntry(source)?.name ?? source : e?.grade === "奇经八脉" ? "奇经（按专属条件）" : "历史未补录"];
  })) : paragraph("尚未打通经脉。");
  const conditional = new Map<string, string[]>();
  for (const s of checks) for (const text of s.conditional) conditional.set(text, [...(conditional.get(text) ?? []), s.name]);
  const checkNotes = [...conditional].map(([text, names]) => `<p><b>${esc(names.join("、"))}：</b>${esc(text)}</p>`).join("") || paragraph("暂无额外检定条件。");
  const skillSheet = chapter("技能与检定", "实体骰检定 · 武器技能", '<p class="lead muted">技能等级与检定加值分列；* 表示附有条件。虚招加值随招式和阶段变化，见对应秘籍。</p>' + section("技能检定与武器技能", `<div class="skill-grid">${skillCards}${weaponCards}</div>`) + section("检定条件", checkNotes));
  const conditionRows = ch.runtime.conditions.map(x => [x.name, `${x.stacks} 层`, x.remaining === null ? "按结束条件" : `${x.remaining} 回合`, [x.anchor, x.note].filter(Boolean).join("；")]);
  const status = paragraph(`当前架招：${stanceMove ? `${stanceMove.name} · 基础格挡 ${stanceMove.block}` : ch.runtime.stance ? `未匹配记录 ${ch.runtime.stance}` : "未开启"}`) + table(["状态", "层数", "持续", "计时参照 / 结束条件 / 备注"], [...conditionRows, ...blankRows(4, 2)], "conditions-table blank-rows") + (t.counters.length ? table(["计数器", "当前值", "备注"], t.counters.map(x => [x.name, x.value, x.note])) : "");
  const inventory = table(["物品", "数量", "装备 / 药效与备注"], [...ownedItems(b).map(i => {
    const e = getEntry(i.id);
    return [inventoryName(i), `${i.quantity}${i.quantity === 0 ? "（已用尽）" : ""}`, [b.activeWeapon === i.id ? "当前持握" : b.equipment.includes(i.id) ? "已装备" : "", e?.slot === "武器" ? `武器伤害 ${e.weaponDamage ?? "未列"} · 武器格挡 ${e.weaponBlock ?? "未列"}` : "", e ? equipmentReference(e).effect : "", i.note].filter(Boolean).join("；")];
  }), ...blankRows(3, 3)], "inventory-table blank-rows");
  const panelNotes = notesHtml(c.warnings);
  const possessions = chapter("内功与行囊", "运功 · 经脉 · 装备 · 桌边记录", section("已学内功", inners || paragraph("未学习内功。")) + section("已通经脉", meridians) + section("装备与行囊", paragraph(`白银：${b.silver}　　收支 / 现值：________________`) + inventory) + section("桌边状态与计数器", status) + (panelNotes ? section("面板补充说明", panelNotes) : ""));

  const moves = groupMoves(effectiveMoves(b)).map(g => section(g.name, g.moves.map(l => {
    const e = getEntry(l.id);
    if (!e) return paragraph(`资料暂缺：${l.id}，保留第 ${l.level} 阶学习记录。`);
    const m = calculateMove(b, e.id, l.level, rules), p = movePresentation(e, m, b), ref = moveReference(e, m), preview = previewMove(b, e.id, l.level, rules);
    const result = e.moveType === "架招" ? `基础格挡 ${m.block}` : m.damageType !== "none" ? `${damageNames[m.damageType]}伤害 ${m.damage ?? "公式未完成"}${m.critical !== null ? ` / 适用暴击 ${m.critical}` : ""}` : p.primary ? `${p.primary.label} ${p.primary.value}` : "辅助效果见下文";
    const facts = [["动作", p.action], ["消耗", p.cost || "原书未列"], ["距离", p.range], ["需求", p.requirement], ["属性", p.affinity], ...(p.target ? [["对象", p.target]] : []), ...(p.duration ? [["持续", p.duration]] : [])];
    const effects = [preview.dice !== "按效果说明进行检定" ? preview.dice : "", preview.feint, p.trigger, p.conditional, ...p.restrictions, ...ref.effects, ...ref.stageBreakdown, ref.upgrade ? `每升一阶：${ref.upgrade}` : ""].filter((s, i, a) => s && a.indexOf(s) === i && (!ref.effects.length ? s !== p.headline : true));
    return `<article class="entry move"><div class="move-heading"><h3>${esc(e.name)}</h3><small>${esc(e.moveType ?? "散手")} · ${esc(rankLabel(e, l.level))} · ${esc(e.grade)}</small></div><p class="result">${esc(result)}</p><div class="move-facts">${facts.map(([k, v]) => `<div><label>${esc(k)}</label>${esc(v)}</div>`).join("")}</div><div class="effects">${ref.effects.length ? "" : paragraph(p.headline)}${effects.map(paragraph).join("")}</div>${notesHtml(m.warnings.filter(w => !w.startsWith("效果待处理：")), e, true)}${options.fullRules ? `<div class="original"><b>完整原文</b>${originalText(e.text)}</div>` : ""}<small>${esc(g.name)} · ${esc(sourceLabel(e))}</small></article>`;
  }).join(""), "routine")).join("");
  const manual = chapter("武学秘籍", "全部已学招式 · 按所属武学分组", '<p class="lead muted">伤害为目标减免前的基础值；条件增伤单列。使用实体骰，资源与状态由桌上手动处理。</p>' + (moves || paragraph("尚未学习招式。")));
  const handwriting = options.handwriting !== false ? chapter("江湖手记", "纸上补充 · 未填项目留白", `<div class="identity">${field("玩家姓名")}${field("字 / 别号")}${field("年龄 / 生辰")}${field("身高 / 体重")}</div><div class="writing-grid"><div class="writing-box portrait"><h3>人物画像 / 外貌特征</h3></div><div class="writing-box"><h3>背景故事 / 个人目标</h3>${ruled(4)}</div></div>${section("人际关系", table(["关系", "姓名 / 身份", "约定 / 牵挂"], [["亲人", "", ""], ["朋友", "", ""], ["敌人", "", ""]], "blank-rows"))}${section("江湖杂记", table(["日期 / 地点", "人物、线索与未竟之事"], blankRows(2, 4), "blank-rows"))}${section("修炼与技艺记录", table(["日期", "内功 / 招式 / 技艺 / 书籍", "投入 / 进度"], blankRows(3, 3), "blank-rows"))}${section("珍藏 / 新得物品", ruled(2))}`, "handwriting") : "";
  const growthRecords = ch.growth?.records ?? [];
  const personal = options.notes ? chapter("经历与笔记", "已保存的文字记录", section("角色笔记", [b.notes, ...t.notes.map(n => `${n.at}\n${n.text}`)].filter(Boolean).map(paragraph).join("") || paragraph("暂无笔记。"), "character-notes") + (growthRecords.length ? section("修炼记录", table(["修炼日", "事项", "修为变动", "备注"], growthRecords.map(r => [r.day, r.label, signed(r.amount), r.note]))) : "")) : "";
  const guide = options.guide ? chapter("桌边规则速查", "查规则 · 用实体骰 · 手动记账", ruleTopics.filter(x => ["types", "feint", "hit", "routine", "states", "damage"].includes(x.id)).map(x => `<article class="entry"><h2>${esc(x.title)}</h2>${paragraph(x.short)}${paragraph(x.example)}<small>正式书 · ${x.pages.join("、")} 页</small></article>`).join("")) : "";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.name)}-A4人物卡</title><style>${characterPrintStyle}</style></head><body><div class="toolbar"><button id="print-pdf" type="button">保存 PDF / 打印</button><p>A4 纵向 · 100% 比例 · 建议关闭浏览器页眉页脚。选择“另存为 PDF”即可下载。<br><small>各部分从新页开始，内容多时自动续页；不需要开启背景图形，黑白打印也清楚。</small></p></div><main>${overview}${skillSheet}${possessions}${manual}${personal}${handwriting}${guide}<footer class="footer">导出 ${esc(date)} · 规则版本 ${esc(RULES_VERSION)} · 资料修订 ${esc(DATA_REVISION)}<br>这是导出时的快照。纸上修改不会同步回网站；需要恢复角色时请另存 JSON 存档。</footer></main><script>document.getElementById('print-pdf').addEventListener('click',function(){window.print()});</script></body></html>`;
}
