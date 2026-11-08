import { describe, expect, it } from "vitest";
import { adminPeriodStart, appPlayerIds } from "./admin-period";

describe("admin statistics reset", () => {
  const now = Date.parse("2026-11-08T10:00:00Z");
  it("counts only iOS and Android players, excluding web and pre-reset activity", () => {
    const created_at = "2026-11-08T09:50:00Z";
    expect([...appPlayerIds([
      { platform: "ios", user_id: "iphone", created_at },
      { platform: "android", user_id: "android", created_at },
      { platform: "ios", user_id: "iphone", created_at },
      { platform: "web", user_id: "browser", created_at },
      { platform: "ios", user_id: "old", created_at: "2026-11-08T09:00:00Z" },
    ], "2026-11-08T09:45:00Z")]).toEqual(["iphone", "android"]);
  });
  it("excludes activity before the reset rather than before the usual 30-day window", () => {
    expect(adminPeriodStart(now, "2026-11-08T09:45:00Z")).toBe(Date.parse("2026-11-08T09:45:00Z"));
  });
  it("keeps the rolling 30 days when the reset is absent or older", () => {
    expect(adminPeriodStart(now, null)).toBe(Date.parse("2026-10-09T10:00:00Z"));
    expect(adminPeriodStart(now, "2026-09-01T00:00:00Z")).toBe(Date.parse("2026-10-09T10:00:00Z"));
  });
});