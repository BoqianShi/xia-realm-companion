"use client";
import { useRef, useState } from "react";
import { CircleHelp, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ruleTopics, findRuleTopics } from "@/lib/rule-guide";

function FeintWalkthrough() {
  const [step, setStep] = useState("破架成功");
  const cases: Record<string, string[]> = {
    "没有命中": ["先投命中：D20＋命中加值 < 对方闪避。", "到此结束：不投虚招对抗，不造成这招的命中效果。"],
    "破架成功": ["命中已成功，对方开着架招。", "地级掌握、武器技能4：虚招骰8＋4＋2×3＝18；对方看破总值18。", "平局归进攻方：解除对方架招，格挡归零，破防一回合；再处理本招伤害和破架效果。"],
    "被看破": ["命中已成功，对方开着架招。", "你的虚招总值18，对方看破19。", "对方有反应动作、可用反击且符合调息：可反击压制，本招中断；超出反击距离则只能压制。", "对方没有反击压制：架招仍在，正常处理这招伤害与怒气。"],
  };
  return <section className="guide-example"><h4>走一遍虚招流程</h4><div className="guide-scenarios" role="group" aria-label="虚招演示结果">{Object.keys(cases).map(s=><button type="button" key={s} className="button" aria-pressed={step===s} onClick={()=>setStep(s)}>{s}</button>)}</div><ol aria-live="polite">{cases[step].map(s=><li key={s}>{s}</li>)}</ol><small>教学示例，不会掷骰或修改角色。</small></section>;
}
export function RulesHelp({ initialTopic="types", label="规则讲解", className="button subtle help-button" }: {initialTopic?:string;label?:string;className?:string}) {
  const [open,setOpen]=useState(false), [query,setQuery]=useState(""), [active,setActive]=useState(initialTopic);
  const trigger=useRef<HTMLButtonElement>(null);
  const found=findRuleTopics(query), topic=found.find(t=>t.id===active)??found[0]??ruleTopics.find(t=>t.id===active)??ruleTopics[0];
  return <><button ref={trigger} type="button" className={className} onClick={e=>{e.stopPropagation();setOpen(true);}} onKeyDown={e=>e.stopPropagation()}><CircleHelp size={16}/>{label}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="rule-guide-dialog" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus();}} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
      <DialogTitle>规则讲解</DialogTitle><DialogDescription>按桌上遇到的问题查。先看一句话，再看步骤和例子。</DialogDescription>
      <label className="guide-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：三种招数、暴击、调息、持续一回合" aria-label="搜索规则讲解"/></label>
      <div className="guide-layout"><nav aria-label="规则讲解目录">{found.length?found.map(t=><button type="button" key={t.id} aria-current={topic.id===t.id?"page":undefined} onClick={()=>{setActive(t.id);}}><small>{t.category}</small><span>{t.title}</span></button>):<p>没有找到。试试“架招”“成长”或“伤害”。</p>}</nav>
      <article className="guide-article" key={topic.id} aria-label={topic.title}><small>{topic.category}</small><h2>{topic.title}</h2><p className="guide-answer">{topic.short}</p>{topic.paragraphs.map((p,i)=><p key={i}>{p}</p>)}
      {(topic.id==="types"||topic.id==="feint")&&<FeintWalkthrough/>}
      <aside className="guide-example"><b>桌上举例</b><p>{topic.example}</p></aside><footer>{topic.book==="expansion"?"拓展书 20241211":"正式书 20241115"} · 印刷页 {topic.pages.join("、")} · 本页为规则释义，招式明确例外优先。</footer></article></div>
    </DialogContent></Dialog></>;
}
export function RuleTerm({ topic: id, label }: { topic: string; label: string }) {
  const t=ruleTopics.find(x=>x.id===id);if(!t)return <span>{label}</span>;
  return <Popover><PopoverTrigger asChild><button type="button" className="rule-term" title={t.short} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>{label}<CircleHelp size={12}/></button></PopoverTrigger><PopoverContent className="rule-term-popover" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><b>{t.title}</b><p>{t.short}</p><p>{t.paragraphs[0]}</p><RulesHelp initialTopic={id} label="看完整步骤与例子" className="text-button"/></PopoverContent></Popover>;
}
