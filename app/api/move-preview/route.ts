import { z } from "zod";
import { buildSchema, rulesSchema } from "@/lib/validation";
import { previewMove } from "@/lib/move-preview";
import { getEntry, maxRank } from "@/lib/catalog";
const value=z.number().finite().min(0).max(100000).optional();
const input=z.object({build:buildSchema,moveId:z.string(),level:z.number().int().min(1).max(4),rules:rulesSchema.optional(),context:z.object({mode:z.string().optional(),noStance:z.boolean().optional(),previousHit:z.boolean().optional(),huajin:value,dao:value,spentRage:value,targetRageLost:value,nineMoves:z.boolean().optional(),extraDamage:value,musicBonus:z.boolean().optional(),targetDefense:value,targetBlock:value,poisonResist:value}).default({})});
export async function POST(request:Request){
 try{const p=input.parse(await request.json()),e=getEntry(p.moveId);if(!e||!['move','special'].includes(e.kind)||p.level>maxRank(e))throw Error('招式或阶段无效');
  return Response.json(previewMove(p.build,p.moveId,p.level,p.rules,p.context));
 }catch(e){return Response.json({error:e instanceof Error?e.message:'无法试算'},{status:400});}
}
