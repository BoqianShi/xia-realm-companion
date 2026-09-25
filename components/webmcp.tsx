"use client";
import {
  catalog,
  getEntry,
  inventoryName,
  ownedItems,
  sourceLabel,
} from "@/lib/catalog";
import { calculateCharacter, calculateMove } from "@/lib/rules";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { useApp } from "./app-context";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function WebMCP() {
  const app = useApp();
  const ref = useRef(app);
  useEffect(() => {
    ref.current = app;
  }, [app]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    const object = (properties: object, required: string[] = []) => ({
      type: "object",
      properties,
      required,
      additionalProperties: false,
    });
    const specs: Tool[] = [
      {
        name: "search_wuxia_rules",
        title: "查找侠界规则",
        description:
          "按名称或原文检索两本规则书，返回资料标识与出处。不会修改角色。",
        inputSchema: object(
          { query: { type: "string" }, kind: { type: "string" } },
          ["query"],
        ),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          const p = z
            .object({
              query: z.string().min(1).max(80),
              kind: z.string().optional(),
            })
            .strict()
            .parse(input);
          return catalog
            .filter(
              (e) =>
                (!p.kind || e.kind === p.kind) &&
                (e.name.includes(p.query) || e.text.includes(p.query)),
            )
            .slice(0, 20)
            .map((e) => ({
              id: e.id,
              name: e.name,
              kind: e.kind,
              source: sourceLabel(e),
            }));
        },
      },
      {
        name: "read_wuxia_character",
        title: "读取角色计算",
        description: "读取指定共享角色的基础属性、全部行囊与已学招式计算结果。",
        inputSchema: object({ characterId: { type: "string" } }, [
          "characterId",
        ]),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          const p = z.object({ characterId: z.string() }).strict().parse(input);
          const a = ref.current;
          const c = a.campaign?.characters.find((x) => x.id === p.characterId);
          if (!c) throw new Error("角色不存在");
          return {
            id: c.id,
            name: c.build.name,
            revision: c.revision,
            attributes: calculateCharacter(c.build),
            inventory: ownedItems(c.build).map((item) => ({
              ...item,
              name: inventoryName(item),
              equipped: c.build.equipment.includes(item.id),
            })),
            moves: c.build.moves.map((l) =>
              calculateMove(c.build, l.id, l.level, a.campaign?.rules),
            ),
          };
        },
      },
      {
        name: "open_wuxia_rule",
        title: "打开规则详情",
        description: "在页面打开指定资料详情。仅导航，不学习或扣除资源。",
        inputSchema: object({ entryId: { type: "string" } }, ["entryId"]),
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) {
          const p = z.object({ entryId: z.string() }).strict().parse(input);
          const e = getEntry(p.entryId);
          if (!e) throw new Error("资料不存在");
          ref.current.setDetail(e);
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          return { opened: e.id, name: e.name };
        },
      },
      {
        name: "stage_wuxia_learning",
        title: "将功法加入试配",
        description:
          "将内功、武学或装备加入独立草稿，不修改正式角色。用户须在构筑页面确认应用。",
        inputSchema: object(
          {
            entryId: { type: "string" },
            level: { type: "integer", minimum: 1, maximum: 4 },
          },
          ["entryId", "level"],
        ),
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) {
          const p = z
            .object({
              entryId: z.string(),
              level: z.number().int().min(1).max(4),
            })
            .strict()
            .parse(input);
          const e = getEntry(p.entryId);
          if (
            !e ||
            ![
              "inner",
              "routine",
              "move",
              "special",
              "equipment",
              "meridian",
            ].includes(e.kind)
          )
            throw new Error("此条目不能加入构筑");
          if (
            (e.kind === "inner" && p.level > 3) ||
            (e.grade !== "天级" && p.level > 3)
          )
            throw new Error("阶段超出范围");
          ref.current.trial(e, p.level);
          ref.current.setBuilderOpen(true);
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          return {
            staged: e.id,
            level: p.level,
            formalCharacterChanged: false,
          };
        },
      },
    ];
    for (const tool of specs)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: life.signal }),
        ).catch(() => {});
      } catch {}
    return () => life.abort();
  }, []);
  return null;
}
