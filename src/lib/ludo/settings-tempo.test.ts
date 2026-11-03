import { describe, expect, it } from "vitest";
import { loadSettings } from "./storage";

describe("game tempo", () => {
  it("only has normal and fast; an old saved 'slow' becomes normal", () => {
    for (const k of Object.keys(localStorage)) if (k.includes("settings")) localStorage.setItem(k, JSON.stringify({ botSpeed: "slow" }));
    localStorage.setItem("mrb-ludo:v1:settings", JSON.stringify({ botSpeed: "slow" }));
    expect(loadSettings().botSpeed).toBe("normal");
  });
});
