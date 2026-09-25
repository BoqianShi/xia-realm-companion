import { z } from "zod";

// Small immutable thumbnails are stored once; character/history records only carry IDs.
export const PORTRAIT_LIMIT = 24000;
export const portraitSchema = z.string().max(PORTRAIT_LIMIT).regex(
  /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/,
  "请上传 PNG、JPG 或 WebP 头像。",
);
export const portraitIdSchema = z.string().max(140).regex(/^[a-zA-Z0-9_-]*$/);
export const portraitsSchema = z.record(portraitIdSchema.min(1), portraitSchema)
  .refine((v) => Object.keys(v).length <= 200, "头像存档已满，请先导出归档。");
export function mergePortraits(current: Record<string, string> | undefined, incoming: Record<string, string> = {}) {
  for (const [id, data] of Object.entries(incoming)) {
    if (current?.[id] && current[id] !== data) throw Error("头像编号与现有存档冲突，请重新选择图片。");
  }
  return portraitsSchema.parse({ ...current, ...incoming });
}
export function portraitExport(portraits: Record<string, string> | undefined, id?: string) {
  return id && portraits?.[id] ? { [id]: portraits[id] } : {};
}
