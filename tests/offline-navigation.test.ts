import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type RequestLike = { method: string; mode: string; url: string };
type NavigationEvent = {
  request: RequestLike;
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (promise: Promise<Response>) => void;
};
test("visiting projector and module reader never replaces the cached character app for offline navigation", async () => {
  let online = true;
  const handlers = new Map<string, (event: NavigationEvent) => void>(),
    stored = new Map<string, Response>();
  const key = (r: string | RequestLike) => (typeof r === "string" ? r : r.url);
  const context = {
    URL,
    Response,
    fetch: async (r: RequestLike) => {
      if (!online) throw Error("offline");
      return new Response(new URL(r.url).pathname);
    },
    caches: {
      open: async () => ({
        put: async (r: string | RequestLike, v: Response) => {
          stored.set(key(r), v);
        },
      }),
      match: async (r: string | RequestLike) => stored.get(key(r))?.clone(),
    },
    self: {
      location: { origin: "https://table.test" },
      addEventListener: (name: string, cb: (event: NavigationEvent) => void) =>
        handlers.set(name, cb),
    },
  };
  vm.runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    context,
  );
  const visit = async (path: string) => {
    const waits: Promise<unknown>[] = [];
    let answer: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://table.test" + path,
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (p: Promise<Response>) => {
        answer = p;
      },
    });
    const response = await answer!;
    await Promise.all(waits);
    return response;
  };
  await visit("/?view=角色");
  await visit("/screen");
  await visit("/adventures/demo-rain-pavilion");
  online = false;
  assert.equal(await (await visit("/?view=先攻")).text(), "/");
  assert.equal(await (await visit("/screen")).text(), "/screen");
  assert.equal(
    await (await visit("/adventures/demo-rain-pavilion")).text(),
    "/adventures/demo-rain-pavilion",
  );
  assert.equal((await visit("/adventures/unvisited")).status, 503);
});
