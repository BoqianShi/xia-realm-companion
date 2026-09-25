import { effectiveMoves, getEntry } from "./catalog.ts";
import type { Build } from "./types.ts";

/** Favorites identify an art; old move IDs resolve to the same art without learning anything. */
export function favoriteArtId(id: string): string {
  const entry = getEntry(id);
  if (entry?.grantedBy) return entry.grantedBy;
  if (entry?.music && entry.kind === "special") return entry.music.bookId;
  const parent = entry?.parentId ? getEntry(entry.parentId) : undefined;
  return parent?.kind === "routine" ? parent.id : id;
}

export function isFavoriteMove(build: Build, id: string): boolean {
  const artId = favoriteArtId(id);
  return build.favorites.some((saved) => favoriteArtId(saved) === artId);
}

export function toggleFavoriteArt(build: Build, id: string): string[] {
  const artId = favoriteArtId(id);
  if (!effectiveMoves(build).some((move) => favoriteArtId(move.id) === artId))
    throw Error("只能收藏已有招式的武学。");
  const favorites = new Set(build.favorites.map(favoriteArtId));
  if (favorites.has(artId)) favorites.delete(artId);
  else favorites.add(artId);
  if (favorites.size > 200) throw Error("常用武学已达 200 项上限。");
  return [...favorites];
}
