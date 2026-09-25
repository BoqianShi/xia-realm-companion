import type {
  ModuleContent,
  ModuleSection,
  ModuleTextBlock,
} from "./module-types.ts";
export function readerSections(m: ModuleContent): ModuleSection[] {
  return m.sections[0]?.page > 1
    ? [{ id: "front-matter", title: "封面与目录", page: 1 }, ...m.sections]
    : m.sections;
}
export function chapterForPage(m: ModuleContent, page: number) {
  return (
    [...readerSections(m)].reverse().find((s) => s.page <= page) ??
    readerSections(m)[0]
  );
}
export function chapterPages(m: ModuleContent, id: string) {
  const sections = readerSections(m),
    index = sections.findIndex((s) => s.id === id);
  if (index < 0) return [];
  return m.pages.filter(
    (p) =>
      p.number >= sections[index].page &&
      p.number < (sections[index + 1]?.page ?? Infinity),
  );
}
export function pageBlocks(
  page: ModuleContent["pages"][number],
): ModuleTextBlock[] {
  return (
    page.blocks ??
    page.text
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((text) => ({ kind: "paragraph", text, spans: [{ text }] }))
  );
}
export function searchModule(m: ModuleContent, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return m.pages.flatMap((p) => {
    const i = p.text.toLowerCase().indexOf(needle);
    return i < 0
      ? []
      : [
          {
            page: p.number,
            label: p.printed ?? p.number,
            title: chapterForPage(m, p.number).title,
            snippet:
              (i > 35 ? "…" : "") +
              p.text
                .slice(Math.max(0, i - 35), i + needle.length + 55)
                .replace(/\s+/g, " ") +
              "…",
          },
        ];
  });
}
