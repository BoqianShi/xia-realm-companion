import { PORTRAIT_LIMIT, portraitSchema } from "./portraits";

export async function preparePortrait(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("请选择 PNG、JPG 或 WebP 图片。");
  if (file.size > 10 * 1024 * 1024) throw Error("图片超过 10 MB，请先缩小后上传。");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw Error("无法读取这张图片，请换一张图片重试。"); });
    if (!img.naturalWidth || !img.naturalHeight) throw Error("图片没有可用尺寸。");
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    for (const size of [256, 192, 128]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("浏览器暂时无法处理图片。");
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      for (const quality of [0.82, 0.65, 0.45]) {
        let data = canvas.toDataURL("image/webp", quality);
        if (!data.startsWith("data:image/webp;")) data = canvas.toDataURL("image/jpeg", quality);
        if (data.length <= PORTRAIT_LIMIT) return portraitSchema.parse(data);
      }
    }
    throw Error("图片细节过多，请裁小后再上传。");
  } finally { URL.revokeObjectURL(url); }
}
