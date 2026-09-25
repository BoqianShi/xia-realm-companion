import { contentPack } from "./content-pack.ts";
import type { ModuleSummary } from "./module-types.ts";
export const modules = contentPack.modules as ModuleSummary[];
export const getModule = (id: string) => modules.find((m) => m.id === id);
