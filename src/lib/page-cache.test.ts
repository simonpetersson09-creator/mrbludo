import { beforeEach, describe, expect, it } from "vitest";
import { readPageCache, writePageCache } from "./page-cache";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  };
});

describe("page cache", () => {
  it("returns the saved copy under the Ludo namespace", () => {
    writePageCache("friends", { n: 3 });
    expect(readPageCache<{ n: number }>("friends")).toEqual({ n: 3 });
    expect([...mem.keys()]).toEqual(["mrb-ludo:v1:cache:friends"]);
  });
  it("returns null for missing or broken entries", () => {
    expect(readPageCache("none")).toBeNull();
    mem.set("mrb-ludo:v1:cache:bad", "{");
    expect(readPageCache("bad")).toBeNull();
  });
});
