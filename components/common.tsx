"use client";
import { RuleNotes } from "./rule-notes";
import { NumberHelp } from "./number-help";
import { explainStat } from "@/lib/explanations";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sourceLabel } from "@/lib/catalog";
import type { CharacterResult, Entry, MoveResult } from "@/lib/types";
import { libraryLabel } from "@/lib/library-index";
import { STAT_KEYS, STAT_NAMES } from "@/lib/types";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
export function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        value={value || "__none"}
        onValueChange={(v) => onChange(v === "__none" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger className="choice" aria-label={label}>
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((x) => (
            <SelectItem key={x.value || "__none"} value={x.value || "__none"}>
              {x.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="check">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </label>
  );
}
export function Warnings({
  items,
  title = "需要核对",
}: {
  items: string[];
  title?: string;
}) {
  if (!items.length) return null;
  return (
    <details className="warning-box" open={items.length < 4}>
      <summary>
        <AlertTriangle size={15} />
        {title} · {items.length} 项
      </summary>
      <ul>
        {[...new Set(items)].map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </details>
  );
}
export function EntryMeta({ entry }: { entry: Entry }) {
  return (
    <div className="entry-meta">
      <span>{libraryLabel(entry)}</span>
      {entry.grade && <span>{entry.grade}</span>}
      {entry.affinity && <span>{entry.affinity}</span>}
      {entry.kind !== "equipment" && <small>{sourceLabel(entry)}</small>}
    </div>
  );
}
export function StatGrid({
  result,
  previous,
}: {
  result: CharacterResult;
  previous?: CharacterResult;
}) {
  return (
    <div className="stat-grid">
      {STAT_KEYS.map((k) => (
        <div key={k}>
          <span>{STAT_NAMES[k]}</span>
          <strong>
            <NumberHelp help={explainStat(result, k)}>
              {result.stats[k]}
            </NumberHelp>
          </strong>
          {previous && result.stats[k] !== previous.stats[k] && (
            <em>
              {result.stats[k] - previous.stats[k] > 0 ? "+" : ""}
              {result.stats[k] - previous.stats[k]}
            </em>
          )}
        </div>
      ))}
    </div>
  );
}
export function Calculation({ result }: { result: CharacterResult }) {
  const labels: Record<string, string> = {
    hpMax: "气血上限",
    mpMax: "内力上限",
    physicalHit: "外功命中",
    internalHit: "内功命中",
    physicalDefense: "外功防御",
    internalDefense: "内功防御",
    physicalCrit: "外功暴击骰",
    internalCrit: "内功暴击骰",
    dodge: "闪避",
    speed: "速度",
    initiative: "先攻",
    block: "未开架招格挡",
    lookThrough: "看破",
    insight: "悟性",
  };
  return (
    <>
      <RuleNotes items={result.warnings} />
      <div className="data-grid">
        {Object.entries(labels).map(([k, v]) => (
          <div key={k}>
            <span>{v}</span>
            <b>
              <NumberHelp help={explainStat(result, k)}>
                {result[k as keyof CharacterResult] as number}
              </NumberHelp>
            </b>
          </div>
        ))}
      </div>
      <details className="disclosure">
        <summary>
          属性计算依据 <ChevronDown size={15} />
        </summary>
        <p className="muted">
          气血 = 体魄 × 4 + 力量 + 固定加成；内力 = 内息 +
          固定加成。基础公式来自正式书第 10 页。
        </p>
        <div className="trace">
          {result.details
            .filter((x) => x.value)
            .map((x, i) => (
              <div key={i}>
                <span>
                  {x.label} ·{" "}
                  {STAT_NAMES[x.key as keyof typeof STAT_NAMES] ??
                    labels[x.key] ??
                    x.key.replace("skill:", "")}
                </span>
                <b>
                  {x.value > 0 ? "+" : ""}
                  {x.value}
                </b>
              </div>
            ))}
        </div>
      </details>
    </>
  );
}
export function MoveNumbers({ move }: { move: MoveResult }) {
  return (
    <div className="move-numbers">
      <div>
        <small>
          {move.type === "架招"
            ? "开启后基础格挡"
            : move.damageType === "none"
              ? "招式作用"
              : "基础伤害"}
        </small>
        <b>
          {move.type === "架招"
            ? move.block
            : move.damageType === "none"
              ? "见效果"
              : (move.damage ?? "待裁定")}
        </b>
      </div>
      <div>
        <small>{move.type === "架招" ? "作用" : "适用暴击"}</small>
        <b>{move.type === "架招" ? "防守" : (move.critical ?? "—")}</b>
      </div>
      <div>
        <small>内力 / 怒气</small>
        <b>
          {move.mpCost ?? "待核对"} <span>/ {move.rageCost}</span>
        </b>
      </div>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="paper empty-character">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
