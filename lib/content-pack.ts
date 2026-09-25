import data from "../.local-content/pack.json" with { type: "json" };
import type { Build, Entry } from "./types.ts";
import type { ModuleContent, ModuleNpc } from "./module-types.ts";
import type { BackgroundGrant } from "./onboarding.ts";
import type { AdventureEncounter } from "./adventure-encounters.ts";

/** Build-time content only. Campaign saves live independently in D1. */
export type ContentPack = {
  schemaVersion: 1;
  id: string;
  title: string;
  rulesVersion: string;
  revision: string;
  sources: { core: string; expansion: string };
  catalog: Entry[];
  modules: ModuleContent[];
  encounters: AdventureEncounter[];
  encounterVersion?: string;
  encounterPeople?: Record<string, ModuleNpc[]>;
  starter: {
    title: string;
    description: string;
    background: string;
    build: Partial<Build>;
    learn: { id: string; level: number }[];
    equipment: string[];
    activeWeapon: string;
    favorites: string[];
    backgroundGrant?: BackgroundGrant;
  };
};
export const contentPack = data as unknown as ContentPack;
