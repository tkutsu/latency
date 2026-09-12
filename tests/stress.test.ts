import { describe, expect, it } from "vitest";
import { createMatrix, set, type RttMatrix } from "@/lib/matrix";
import type { Coordinates } from "@/lib/mds";
import { median, residualsPerNode, round, totalStress } from "@/lib/stress";

/** Three anchors on a line, 10 ms apart, with honest coordinates to match. */
function exact(): { matrix: RttMatrix; coordinates: Coordinates } {
  const matrix = createMatrix(3);
  set(matrix, 0, 1, 10);
  set(matrix, 1, 0, 10);
  set(matrix, 1, 2, 10);
  set(matrix, 2, 1, 10);
  set(matrix, 0, 2, 20);
  set(matrix, 2, 0, 20);
  return {
    matrix,
    coordinates: {
      x: Float64Array.from([0, 10, 20]),
      y: Float64Array.from([0, 0, 0]),
    },
  };
}

const places = [
  { latitude: 50, longitude: 0 },
  { latitude: 50, longitude: 10 },
  { latitude: 50, longitude: 20 },
];

describe("totalStress", () => {
  it("is zero when the layout matches every measurement", () => {
    const { matrix, coordinates } = exact();
    expect(totalStress(matrix, coordinates)).toBeCloseTo(0, 12);
  });

  it("ignores pairs with no measurement", () => {
    const { matrix, coordinates } = exact();
    set(matrix, 0, 2, Number.NaN);
    set(matrix, 2, 0, Number.NaN);
    // Move node 2 somewhere the missing pair would have objected to.
    coordinates.y[2] = 40;
    // The 1–2 pair is now 41.2 ms across where 10 was measured.
    expect(totalStress(matrix, coordinates)).toBeGreaterThan(15);
  });
});

describe("residualsPerNode", () => {
  it("reports no residual for an exact layout", () => {
    const { matrix, coordinates } = exact();
    for (const residual of residualsPerNode(matrix, coordinates, places)) {
      expect(residual.stress).toBeCloseTo(0, 12);
      expect(residual.bias).toBeCloseTo(0, 12);
      expect(residual.measuredPairs).toBe(2);
    }
  });

  it("signs the bias positive when a node is really further out", () => {
    const { matrix, coordinates } = exact();
    // Both measurements to node 2 say it is twice as far as it is drawn.
    set(matrix, 1, 2, 20);
    set(matrix, 2, 1, 20);
    set(matrix, 0, 2, 40);
    set(matrix, 2, 0, 40);
    const residuals = residualsPerNode(matrix, coordinates, places);
    expect(residuals[2].bias).toBeGreaterThan(0);
    expect(residuals[2].stress).toBeGreaterThan(0);
  });

  it("ranks the worst pair first", () => {
    const { matrix, coordinates } = exact();
    set(matrix, 0, 2, 90);
    set(matrix, 2, 0, 90);
    const residuals = residualsPerNode(matrix, coordinates, places);
    expect(residuals[0].worst[0].index).toBe(2);
  });

  it("measures the detour against the fibre floor, not the drawn distance", () => {
    const { matrix, coordinates } = exact();
    const residuals = residualsPerNode(matrix, coordinates, places);
    // 10 degrees of longitude at 50°N is about 715 km, so the floor is about
    // 7.2 ms and a measured 10 ms is roughly 1.4 times it.
    expect(residuals[1].detourRatio).toBeGreaterThan(1.2);
    expect(residuals[1].detourRatio).toBeLessThan(1.6);
  });
});

describe("median", () => {
  it("averages the middle pair when the count is even", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("takes the middle when the count is odd", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("is zero for nothing", () => {
    expect(median([])).toBe(0);
  });
});

describe("round", () => {
  it("keeps the digits asked for", () => {
    expect(round(1.23456, 2)).toBe(1.23);
  });
});
