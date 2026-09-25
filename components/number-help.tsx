"use client";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { X, CircleHelp } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Explanation } from "@/lib/explanations";

export function NumberHelp({
  help,
  children,
}: {
  help: Explanation;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={children != null ? "explain-number" : "explain-icon"}
          aria-label={`${help.title}${typeof children === "number" || typeof children === "string" ? ` ${children}` : ""}：查看计算说明`}
          title={help.formula}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {children ?? <CircleHelp size={16} />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="number-help"
        sideOffset={8}
        collisionPadding={14}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="section-heading">
          <h3>{help.title}</h3>
          <button
            className="icon-button"
            aria-label="关闭计算说明"
            onClick={() => setOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <p className="number-help-formula">{help.formula}</p>
        {!!help.rows.length && (
          <dl>
            {help.rows.map((x, i) => (
              <div key={i}>
                <dt>{x.label}</dt>
                <dd>{x.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {help.notes.map((n, i) => (
          <p className="number-help-note" key={i}>
            {n}
          </p>
        ))}
        {help.source && <small>{help.source}</small>}
      </PopoverContent>
    </Popover>
  );
}
