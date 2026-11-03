import { expect, it } from "vitest";
import { pieceWaypoints } from "./piece-motion";
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