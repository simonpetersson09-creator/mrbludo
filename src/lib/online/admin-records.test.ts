import { describe, expect, it } from "vitest";
import { adminCellValue, adminRecordIndexes, adminRollingMean, type AdminDayRow } from "./admin-records";

const row: AdminDayRow = { day: "2026-11-08", devices: 2, ios: null, android: null, played: null, total: 3, cpu_finished: null, online_finished: null, forfeits: 1, issues: 0, incomplete_columns: ["issues"] };
describe("Ludo admin metric adaptation", () => {
  it("preserves finished totals without inventing local and online breakdowns", () => {
    expect(adminCellValue(row, "total")).toBe(3);
    expect(adminRollingMean([row], row.day, "cpu_finished")).toBeNull();
    expect(adminRecordIndexes([row], ["ios", "issues"])).toEqual({ ios: -1, issues: -1 });
  });
  it("computes averages only from complete available days", () => {
    expect(adminRollingMean([row], row.day, "devices")).toBe(2);
    expect(adminRollingMean([{ ...row, day: "2026-11-06" }, row], row.day, "devices")).toBeNull();
  });
});