import { expect, it } from "vitest";
import { pieceWaypoints, walkDurationMs, STEP_MS } from "./piece-motion";
import { pieceCenter } from "./board";

it("walks all five squares in order for a five", () => {
  expect(pieceWaypoints(0, 4, 9, 0)).toEqual([4, 5, 6, 7, 8, 9].map(p => pieceCenter(0, p, 0)));
});
it("walks through the home lane to the exact goal", () => {
  expect(pieceWaypoints(1, 50, 56, 2)).toEqual([50, 51, 52, 53, 54, 55, 56].map(p => pieceCenter(1, p, 2)));
});
it("does not walk a captured piece backward around the board", () => {
  expect(pieceWaypoints(0, 24, -1, 0)).toEqual([pieceCenter(0, 24, 0), pieceCenter(0, -1, 0)]);
});

it("waits exactly as long as the board walks a normal move", () => {
  expect(walkDurationMs(0, 4, 9, 0, 5)).toEqual((pieceWaypoints(0, 4, 9, 0, 5).length - 1) * STEP_MS);
  expect(walkDurationMs(0, 4, 9, 0, 5)).toEqual(5 * 185);
});
it("counts every square of a walk out of the yard", () => {
  expect(walkDurationMs(0, -1, 6, 0, 6)).toEqual((pieceWaypoints(0, -1, 6, 0, 6).length - 1) * STEP_MS);
  expect(walkDurationMs(0, -1, 6, 0, 6)).toEqual(7 * 185);
});
it("counts the bounce off the goal in Fia", () => {
  const walk = pieceWaypoints(0, 41, 42, 0, 5, "fia");
  expect(walk).toHaveLength(6);
  expect(walkDurationMs(0, 41, 42, 0, 5, "fia")).toEqual((walk.length - 1) * STEP_MS);
});
it("holds longer when the move knocks a piece out", () => {
  expect(walkDurationMs(0, 4, 9, 0, 5, "classic", true)).toEqual(5 * 185 + 2.4 * 185);
});
it("still counts the squares when the roll behind the move is unknown", () => {
  expect(walkDurationMs(0, 4, 9, 0, null)).toEqual(5 * 185);
});