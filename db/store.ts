import { env } from "cloudflare:workers";
import { emptyCampaign, applyCommand, DomainError } from "../lib/campaign";
import type { Command } from "../lib/validation";
import type { Envelope, Campaign } from "../lib/types";
function database(): D1Database {
  if (!env.DB) throw new Error("共享存档暂不可用。");
  return env.DB;
}
export async function readCampaign(): Promise<Envelope> {
  const db = database();
  let row = await db
    .prepare("SELECT version, data FROM campaigns WHERE id = ?")
    .bind("default")
    .first<{ version: number; data: string }>();
  if (!row) {
    await db
      .prepare(
        "INSERT INTO campaigns (id, version, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(
        "default",
        0,
        JSON.stringify(emptyCampaign()),
        new Date().toISOString(),
      )
      .run();
    row = await db
      .prepare("SELECT version, data FROM campaigns WHERE id = ?")
      .bind("default")
      .first<{ version: number; data: string }>();
  }
  if (!row) throw new Error("存档读取失败。");
  return { version: row.version, campaign: JSON.parse(row.data) as Campaign };
}
export async function mutateCampaign(cmd: Command): Promise<Envelope> {
  const current = await readCampaign();
  if (current.campaign.receipts[cmd.requestId]) return current;
  if (current.version !== cmd.expectedVersion)
    throw new DomainError(
      "其他设备已更新存档。已保留你的草稿，请刷新后重新核对。",
      409,
    );
  const campaign = applyCommand(current.campaign, cmd);
  const serialized = JSON.stringify(campaign);
  if (serialized.length > 8000000)
    throw new DomainError("本团存档过大，请先导出归档。");
  const result = await database()
    .prepare(
      "UPDATE campaigns SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
    )
    .bind(serialized, new Date().toISOString(), "default", current.version)
    .run();
  if (!result.meta.changes) {
    const latest = await readCampaign();
    if (latest.campaign.receipts[cmd.requestId]) return latest;
    throw new DomainError("另一个操作刚刚完成，请刷新后重新核对。", 409);
  }
  return { version: current.version + 1, campaign };
}
