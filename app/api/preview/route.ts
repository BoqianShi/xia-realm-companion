import { readCampaign } from "@/db/store";
import { actionSchema, buildSchema } from "@/lib/validation";
import { previewAction, calculateCharacter } from "@/lib/rules";
export async function POST(request: Request) {
  try {
    const p = (await request.json()) as {
      type?: string;
      build?: unknown;
      input?: unknown;
    };
    if (p.type === "character")
      return Response.json(calculateCharacter(buildSchema.parse(p.build)));
    const { campaign } = await readCampaign();
    return Response.json(previewAction(campaign, actionSchema.parse(p.input)));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "无法计算预览。" },
      { status: 400 },
    );
  }
}
