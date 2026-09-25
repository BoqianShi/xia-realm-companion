export type ModuleSection = { id: string; title: string; page: number };
export type ModuleSummary = {
  id: string;
  title: string;
  edition: string;
  difficulty: string;
  players: string;
  author: string;
  intro: string;
  note: string;
  version: string;
  contentRevision?: string;
  pdf: string;
  sections: ModuleSection[];
  npcPages: number[];
  pageCount: number;
  assetCount: number;
  npcCount: number;
  contentUrl: string;
  cover: string;
};
export type ModuleAsset = {
  id: string;
  name: string;
  kind: string;
  url: string;
  preview?: string;
  source?: string;
  size: number;
};
export type ModuleNpc = {
  id: string;
  name: string;
  group: string;
  kind?: "npc" | "beast" | "preset" | "hazard";
  aliases?: string[];
  description?: string;
  missing?: string[];
  encounters?: string[];
  sourcePage?: number;
  inner: string;
  note: string;
  source: string;
  url: string;
  fields: { label: string; value: string }[];
  moves: {
    name: string;
    type: string;
    distance: string;
    cost: string;
    damage: string;
    resultLabel?: string;
    effect: string;
    sourceCell: string;
  }[];
  rows: { cell: string; value: string }[][];
};
export type ModuleContent = ModuleSummary & {
  pages: {
    number: number;
    printed: number | null;
    title: string;
    text: string;
    blocks?: ModuleTextBlock[];
    image: string;
  }[];
  assets: ModuleAsset[];
  npcs: ModuleNpc[];
};
export type ModuleTextBlock = {
  kind:
    | "paragraph"
    | "heading"
    | "subheading"
    | "list-item"
    | "note"
    | "check"
    | "dialogue";
  text: string;
  spans: { text: string; bold?: boolean; tone?: "dialogue" | "warning" }[];
};
export type ModuleNotebook = {
  id: string;
  sourceVersion: string;
  revision: number;
  importedAt: string;
  notes: string;
  completed: string[];
  bookmark: number;
  updatedAt: string;
};
