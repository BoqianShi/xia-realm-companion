import { z } from "zod";
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i);
// Entity IDs are data, not filesystem paths. Preserve historical Chinese IDs.
const entityId = z.string().min(1).max(140).regex(/^[\p{L}\p{N}_／-]+$/u);
const text = z.string();
const number = z.number().finite();
const stats = z.object(Object.fromEntries(["strength", "agility", "body", "breath", "qi", "spirit"].map(k => [k, number])));
const modifier = z.object({ key: text, value: number, label: text }).passthrough();
const entry = z.object({
  id: text.min(1), kind: z.enum(["inner", "routine", "move", "special", "equipment", "background", "personality", "meridian", "status", "skill", "sect", "reference"]),
  name: text.min(1), grade: text, sect: text, text,
  source: z.object({ book: z.enum(["core", "expansion"]), version: text, page: number.nullable(), pdfPage: number }),
  parentId: text.optional(), grantedBy: text.optional(), relatedIds: z.array(text).optional(),
  stages: z.array(z.object({ stage: number.int().positive(), stats })).optional(),
  costs: z.array(number.nonnegative()).optional(),
  learning: z.object({ mode: z.enum(["bespoke", "read", "once"]), stages: z.array(z.object({ level: number.int().positive(), name: text, cost: number.nonnegative() })).nonempty() }).optional(),
  formula: z.object({
    terms: z.array(z.object({ stat: z.enum(["strength", "agility", "body", "breath", "qi", "spirit"]), coefficient: number })),
    fixed: number.nullable(), damageType: z.enum(["physical", "internal", "poison", "bleed", "fire", "mental", "none"]), damageUpgrade: number,
    mp: number, mpUpgrade: number, rage: number, rageUpgrade: number, block: number, blockUpgrade: number,
    distance: number, distanceUpgrade: number, action: z.enum(["main", "minor", "simple", "charge", "reaction"]),
  }).optional(),
  modifiers: z.array(modifier).optional(), effectModifiers: z.array(modifier).optional(),
}).passthrough();
const localUrl = z.string().refine(v => !v || /^\/modules\/[a-z0-9/_-]+\.(png|jpg|jpeg|webp|pdf|txt|docx?|xlsx?|json)(?:#page=[1-9][0-9]*)?$/i.test(v), "Use declared local /modules/ assets");
const npc = z.object({
  id: entityId, name: text, group: text, inner: text, note: text, source: text, url: localUrl,
  fields: z.array(z.object({ label: text, value: text })),
  moves: z.array(z.object({ name: text, type: text, distance: text, cost: text, damage: text, effect: text, sourceCell: text }).passthrough()),
  rows: z.array(z.array(z.object({ cell: text, value: text }))),
}).passthrough();
const module = z.object({
  id, title: text, edition: text, difficulty: text, players: text, author: text, intro: text, note: text, version: text,
  pdf: localUrl, cover: localUrl, contentUrl: localUrl,
  sections: z.array(z.object({ id, title: text, page: number.int().positive() })),
  npcPages: z.array(number.int().positive()), pageCount: number.int(), assetCount: number.int(), npcCount: number.int(),
  pages: z.array(z.object({ number: number.int().positive(), printed: number.nullable(), title: text, text, image: localUrl }).passthrough()),
  assets: z.array(z.object({ id, name: text, kind: text, url: localUrl }).passthrough()), npcs: z.array(npc),
}).passthrough();
const packSchema = z.object({
  schemaVersion: z.literal(1), id, title: text.min(1), rulesVersion: text.min(1), revision: text.min(1),
  sources: z.object({ core: text, expansion: text }), catalog: z.array(entry), modules: z.array(module),
  encounterVersion: text.min(1).optional(),
  encounterPeople: z.record(id, z.array(npc)).optional(),
  encounters: z.array(z.object({
    id, moduleId: id, title: text, kind: text, pages: z.array(number.int().positive()), trigger: text, notes: z.array(text),
    cast: z.array(z.object({ id, npcId: entityId, name: text, count: number.int().min(0).max(30).nullable(), role: z.enum(["opening", "reserve", "support"]), side: z.enum(["ally", "enemy"]), note: text, optional: z.boolean(), maximum: number.nullable(), hp: number.nullable(), hpDelta: number.nullable(), track: z.boolean() })),
  })),
  starter: z.object({ title: text, description: text, background: text, build: z.object({}).passthrough(), learn: z.array(z.object({ id: text, level: number.int().min(1).max(4) })), equipment: z.array(text), activeWeapon: text, favorites: z.array(text), backgroundGrant: z.object({ moves: z.array(text), equipment: z.array(text), quantities: z.record(number.int().nonnegative()).optional(), silver: number, previousWeapon: text, warnings: z.array(text) }).optional() }),
  assets: z.array(z.object({ file: z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+$/), path: z.string().regex(/^[a-z0-9/_-]+\.(png|jpe?g|webp|pdf|txt|docx?|xlsx?)$/i) })).optional(),
});
export function validatePack(input) {
  const pack = packSchema.parse(input);
  const unique = (items, label) => { if (new Set(items).size !== items.length) throw Error(`Duplicate ${label}`); };
  unique(pack.catalog.map(e => e.id), "entry ID"); unique(pack.modules.map(m => m.id), "module ID"); unique(pack.encounters.map(e => e.id), "encounter ID");
  const byId = new Map(pack.catalog.map(e => [e.id, e]));
  const requireEntry = (id) => { if (id && !byId.has(id)) throw Error(`Unknown entry: ${id}`); };
  for (const e of pack.catalog) {
    if (e.parentId && byId.get(e.parentId)?.kind !== "routine") throw Error(`Invalid routine parent: ${e.id}`);
    if (e.grantedBy) requireEntry(e.grantedBy);
    for (const id of e.relatedIds || []) requireEntry(id);
  }
  const s = pack.starter;
  [s.background, s.activeWeapon, s.build.personality, s.build.activeInner, ...s.favorites, ...s.equipment, ...s.learn.map(l => l.id)].filter(Boolean).forEach(requireEntry);
  for (const [moduleId, people] of Object.entries(pack.encounterPeople ?? {})) {
    const m = pack.modules.find(m => m.id === moduleId);
    if (!m) throw Error(`Unknown encounter NPC module: ${moduleId}`);
    unique(people.map(n => n.id), "encounter NPC ID");
    if (people.some(n => n.sourcePage && !m.pages[n.sourcePage - 1])) throw Error(`Invalid NPC page: ${moduleId}`);
  }
  for (const m of pack.modules) {
    unique(m.npcs.map(n => n.id), "NPC ID");
    if (m.pages.some((p, i) => p.number !== i + 1) || m.pageCount !== m.pages.length || [...m.npcPages, ...m.sections.map(s => s.page), ...m.npcs.map(n => n.sourcePage).filter(Boolean)].some(p => !m.pages[p - 1])) throw Error(`Invalid page sequence: ${m.id}`);
  }
  for (const e of pack.encounters) {
    const m = pack.modules.find(m => m.id === e.moduleId);
    const people = pack.encounterPeople ? pack.encounterPeople[e.moduleId] ?? [] : m?.npcs ?? [];
    if (!m || e.pages.some(p => !m.pages[p - 1]) || e.cast.some(a => !people.some(n => n.id === a.npcId))) throw Error(`Unknown encounter module/NPC: ${e.id}`);
    unique(e.cast.map(a => a.id), "actor ID");
  }
  const paths = (pack.assets || []).map(a => a.path);
  unique(paths, "asset path");
  if (paths.some(p => p.split("/").includes("..") || p.startsWith("/"))) throw Error("Invalid asset path");
  const urls = new Set(paths.map(p => `/modules/${p}`));
  for (const m of pack.modules) {
    for (const url of [m.cover, m.pdf, ...m.pages.map(p => p.image), ...m.assets.flatMap(a => [a.url, a.preview]), ...m.npcs.map(n => n.url), ...(pack.encounterPeople?.[m.id] ?? []).map(n => n.url)].filter(Boolean))
      if (!localUrl.safeParse(url).success || !urls.has(url.split("#")[0])) throw Error(`Undeclared asset: ${url}`);
  }
  return pack;
}
