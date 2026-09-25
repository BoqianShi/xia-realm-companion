"use client";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Check } from "./common";
import { characterPrintHtml, type PrintOptions } from "@/lib/character-print";
import type { Character, Rulings } from "@/lib/types";
export function CharacterPrint({ch,rules}:{ch:Character;rules?:Rulings}) {
  const [open,setOpen]=useState(false),[options,setOptions]=useState<PrintOptions>({notes:false,fullRules:false,guide:false,handwriting:true}),[error,setError]=useState("");
  const preview=()=>{
    const html=characterPrintHtml(ch,rules,options);
    const tab=window.open("", "_blank");
    if(!tab){setError("预览窗口被浏览器拦截。请允许本站打开弹出窗口，再点一次。手机也可换用浏览器打开本站。");return;}
    tab.opener=null;tab.document.open();tab.document.write(html);tab.document.close();setError("");setOpen(false);
  };
  return <><button className="button" onClick={()=>setOpen(true)}><FileDown size={15}/>导出 PDF / 打印</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="print-options"><DialogTitle>导出 {ch.build.name} 的人物卡</DialogTitle><DialogDescription>A4 纵向，适合黑白打印。参考纸质人物卡分区，内容多时自动续页，不缩小字号硬塞一页。</DialogDescription><p>依次包含人物总览、技能与检定、内功与行囊、武学秘籍。全部已学招式都会导出；当前资源旁留有手写位置。</p><Check label="附加空白江湖手记（画像、关系、修炼和杂记）" checked={!!options.handwriting} onChange={handwriting=>setOptions({...options,handwriting})}/><Check label="附加已保存的角色笔记、速记与修炼记录" checked={!!options.notes} onChange={notes=>setOptions({...options,notes})}/><Check label="附加每招完整原文（页数较多）" checked={!!options.fullRules} onChange={fullRules=>setOptions({...options,fullRules})}/><Check label="附加桌边规则速查" checked={!!options.guide} onChange={guide=>setOptions({...options,guide})}/><p className="muted">打开预览后选择“保存 PDF / 打印”，再选“另存为 PDF”。按已保存角色生成；纸上修改不会同步回网站。可恢复的备份请另存 JSON。</p>{error&&<p role="alert">{error}</p>}<button className="button primary" onClick={preview}>打开打印预览</button></DialogContent></Dialog></>;
}
