"use client";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./ui/sheet";
export function ReferenceDrawer({
  open = true,
  title,
  description,
  close,
  children,
}: {
  open?: boolean;
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <SheetContent className="table-card-panel" showCloseButton={false}>
        <header className="table-card-heading">
          <div>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </div>
          <SheetClose
            className="button icon-button"
            aria-label="关闭资料，返回原处"
          >
            <X size={20} />
          </SheetClose>
        </header>
        <div className="table-card-scroll">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
