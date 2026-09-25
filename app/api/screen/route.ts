import { readCampaign } from "@/db/store";
import { screenProjection } from "@/lib/hosting";
export async function GET() {
  try {
    const { campaign, version } = await readCampaign();
    return Response.json(
      { version, ...screenProjection(campaign) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "暂时无法同步投屏。" }, { status: 503 });
  }
}
