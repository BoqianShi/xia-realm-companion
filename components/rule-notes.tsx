import { ruleNotes, noteLabels } from "@/lib/rule-notes";
import type { Entry } from "@/lib/types";
export function RuleNotes({items,baseline,entry,hideShared=false}:{items:string[];baseline?:string[];entry?:Entry;hideShared?:boolean}) {
  const notes=ruleNotes(items,{baseline,entry,hideShared});if(!notes.length)return null;
  const important=notes.filter(n=>n.kind==="attention"||n.kind==="input"), extra=notes.filter(n=>!important.includes(n));
  return <div className="rule-notes">{!!important.length&&<div className="rule-attention">{important.map((n,i)=><p key={i}><b>{noteLabels[n.kind]}：</b>{n.text}</p>)}</div>}{!!extra.length&&<details className="rule-note-details"><summary>{extra.some(n=>n.kind==="calculation")?"计算范围与现场效果":"现场效果说明"}</summary>{extra.some(n=>n.kind==="calculation")&&<p className="muted">下面标注“面板未计入”的效果需另行处理；不是要求重新检查整张卡。</p>}{extra.map((n,i)=><p key={i}><b>{noteLabels[n.kind]} · </b>{n.text}</p>)}</details>}</div>;
}
