import type { Entry } from "./types.ts";
export type RuleNoteKind = "attention" | "input" | "calculation" | "table";
export type RuleNote = { text: string; kind: RuleNoteKind; shared: boolean };
const normalized = (s:string)=>s.replace(/^常驻\/条件效果待核对：/,"").replace(/\s/g,"");
/** Only reviewed presentation duplicates are removed. Unknown numerical effects remain visible. */
export function ruleNotes(items: string[], options: { baseline?: string[]; entry?: Entry; hideShared?: boolean } = {}): RuleNote[] {
  const seen=new Set<string>(), baseline=new Set((options.baseline??[]).map(normalized));
  return items.flatMap(raw=>{
    const key=normalized(raw);if(seen.has(key))return [];seen.add(key);
    const shared=raw.startsWith("常驻/条件效果待核对：")||baseline.has(key);
    if(shared&&options.hideShared)return [];
    // These exact stage effects already have a reviewed, current-stage breakdown on the card.
    if(raw.startsWith("阶段附加效果请核对：")&&["core-move-efffd2a3baef","core-move-d2d50cfae877","core-move-5bf5a314e740","expansion-move-5d82f32726ae","expansion-move-e9e883aa8a9b","expansion-move-96ee14188dc5"].includes(options.entry?.id??""))return [];
    let kind:RuleNoteKind="calculation";
    if(/缺少第.*阶段属性|尚无可用结算公式|待裁定取整|尚未裁定|取整.*待裁定|伤害公式待校对|原文包含可变值|尚未持握所需武器/.test(raw))kind="attention";
    else if(/请提供|请(?:输入|补充)|消耗当前所有内力|消耗包含当前资源/.test(raw))kind="input";
    else if(/^(效果待处理：|阶段附加效果请核对：)/.test(raw)||/子敬冠：阅读指定类别书籍时|书笈：手持书籍时|本招按内力上限百分比消耗/.test(key))kind="table";
    const text=raw.replace(/^常驻\/条件效果待核对：/,"").replace(/^效果待处理：/,"").replace(/^阶段附加效果请核对：/,"阶段变化：").replace(/；请在成长记录中处理。/,"；在成长记录中手动记录。").replace(/须由 DM 核对。/,"按当前使用条件判断。");
    return [{text,kind,shared}];
  });
}
export const noteLabels:Record<RuleNoteKind,string>={attention:"使用前确认",input:"需要补充",calculation:"面板未计入",table:"现场效果"};
