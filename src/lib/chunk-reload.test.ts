import { describe, expect, it } from "vitest";
import { chunkReloadDelayMs, CHUNK_RELOAD_KEY, isStaleChunkError, isStaleNotice, MAX_CHUNK_RELOADS, staleGiveUpHref, tryStaleChunkReload } from "./chunk-reload";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    dump: () => Object.fromEntries(data),
  };
}

describe("isStaleChunkError", () => {
  it("recognizes the ways a missing code file is reported", () => {
    for (const message of [
      "Importing a module script failed.",
      "Failed to fetch dynamically imported module: http://localhost:8080/src/routes/play.tsx",
      "error loading dynamically imported module",
      "Unable to preload CSS for /assets/play-abc.js",
    ]) {
      expect(isStaleChunkError(new Error(message))).toBe(true);
      expect(isStaleChunkError(message)).toBe(true);
    }
  });

  it("looks through a wrapped cause", () => {
    const wrapped = new Error("Loader paused", { cause: new Error("Importing a module script failed.") });
    expect(isStaleChunkError(wrapped)).toBe(true);
  });

  it("leaves ordinary problems alone", () => {
    expect(isStaleChunkError(new Error("Något gick fel"))).toBe(false);
    expect(isStaleChunkError(new TypeError("x is not a function"))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError("")).toBe(false);
    expect(isStaleChunkError({})).toBe(false);
  });
});

describe("tryStaleChunkReload", () => {
  it("waits longer for every try", () => {
    expect(chunkReloadDelayMs(0)).toBe(250);
    expect(chunkReloadDelayMs(1)).toBe(750);
    expect(chunkReloadDelayMs(2)).toBe(1250);
  });

  it("counts the tries and reloads with backoff", () => {
    const storage = memoryStorage();
    const calls: Array<{ ms: number }> = [];
    let reloaded = 0;
    const deps = {
      storage,
      schedule: (run: () => void, ms: number) => { calls.push({ ms }); run(); },
      reload: () => { reloaded += 1; },
    };
    for (let i = 0; i < MAX_CHUNK_RELOADS; i++) expect(tryStaleChunkReload(deps)).toBe(true);
    expect(reloaded).toBe(MAX_CHUNK_RELOADS);
    expect(calls.map((c) => c.ms)).toEqual([250, 750, 1250]);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe(String(MAX_CHUNK_RELOADS));
  });

  it("gives up instead of reloading forever", () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(MAX_CHUNK_RELOADS) });
    let scheduled = 0;
    let reloaded = 0;
    const ran = tryStaleChunkReload({ storage, schedule: () => { scheduled += 1; }, reload: () => { reloaded += 1; } });
    expect(ran).toBe(false);
    expect(scheduled).toBe(0);
    expect(reloaded).toBe(0);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe(String(MAX_CHUNK_RELOADS));
  });

  it("does nothing when storage is unavailable", () => {
    expect(tryStaleChunkReload({ storage: null, schedule: () => { throw new Error("must not schedule"); } })).toBe(false);
  });
});

describe("the give-up path", () => {
  it("sends a used-up reload to the home screen for a brand new copy of the page", () => {
    expect(staleGiveUpHref("http://localhost:8080/online/abc?x=1#/top", 123)).toBe("/?stale=1&fresh=123");
    expect(staleGiveUpHref("https://mrbludo.lovable.app/settings", 4567)).toBe("/?stale=1&fresh=4567");
    expect(staleGiveUpHref("capacitor://localhost/index.html", 8)).toBe("/?stale=1&fresh=8");
  });

  it("never loops when the marker is already there", () => {
    expect(staleGiveUpHref("http://localhost:8080/?stale=1&fresh=9")).toBeNull();
    expect(staleGiveUpHref("not a url")).toBeNull();
  });

  it("reads the marker back on the home screen", () => {
    expect(isStaleNotice("?stale=1")).toBe(true);
    expect(isStaleNotice("?x=2&stale=1")).toBe(true);
    expect(isStaleNotice("?stale=1&fresh=99")).toBe(true);
    expect(isStaleNotice("")).toBe(false);
    expect(isStaleNotice("?stale=0")).toBe(false);
    expect(isStaleNotice("?stale")).toBe(false);
  });
});
