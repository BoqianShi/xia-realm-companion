"use client";
import type { Character } from "@/lib/types";
import { PlaySheet } from "./play-sheet";
import { ReferenceDrawer } from "./reference-drawer";
export function PartyDetails({
  character: ch,
  onClose,
}: {
  character: Character | null;
  onClose: () => void;
}) {
  return (
    <ReferenceDrawer
      open={!!ch}
      title={`${ch?.build.name ?? "角色"} · 桌边人物卡`}
      description="查看与手动记录这位角色，保留你当前选择的角色及页面位置。"
      close={onClose}
    >
      {ch && <PlaySheet key={ch.id} ch={ch} inspection />}
    </ReferenceDrawer>
  );
}
