import { readCampaign, mutateCampaign } from "@/db/store";
import { commandSchema } from "@/lib/validation";
import { DomainError } from "@/lib/campaign";
export async function GET() {
  try {
    return Response.json(await readCampaign(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Campaign read failed", e);
    return Response.json(
      { error: "共享存档暂时无法连接，请稍后重试。" },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "不允许跨站写入。" }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 8500000)
      return Response.json({ error: "存档文件过大。" }, { status: 413 });
    const command = commandSchema.parse(JSON.parse(raw));
    return Response.json(await mutateCampaign(command));
  } catch (e) {
    if (e instanceof DomainError)
      return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof SyntaxError)
      return Response.json(
        { error: "提交内容不是有效的存档。" },
        { status: 400 },
      );
    if (e && typeof e === "object" && "issues" in e)
      return Response.json(
        { error: "数据格式不正确，请核对输入与规则版本。", issues: e.issues },
        { status: 400 },
      );
    console.error("Campaign mutation failed", e);
    return Response.json(
      { error: "保存未完成，请保留草稿并重试。" },
      { status: 503 },
    );
  }
}
