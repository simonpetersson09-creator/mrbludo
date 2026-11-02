import { describe, expect, it } from "vitest";
import { isPlayerStorageKey } from "./player-data";

describe("delete player data", () => {
  it("clears Ludo player keys", () => {
    expect(isPlayerStorageKey("mrb-ludo:v1:stats")).toBe(true);
    expect(isPlayerStorageKey("mrb-ludo:v1:avatar-image")).toBe(true);
  });
  it("keeps the language choice and never touches other apps' keys", () => {
    expect(isPlayerStorageKey("mrb-ludo:v1:language")).toBe(false);
    expect(isPlayerStorageKey("yatzy_device_id")).toBe(false);
  });
});
