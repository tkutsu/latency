import { describe, expect, it } from "vitest";
import { createMatrix, set, type RttMatrix } from "@/lib/matrix";
import { classicalMds, embed, smacof } from "@/lib/mds";

/** The exact distance matrix of a set of known points. */
function matrixOf(points: [number, number][]): RttMatrix {
  const matrix = createMatrix(points.length);
  for (let i = 0; i < points.length; i += 1) {
    for (let j = 0; j < points.length; j += 1) {
      set(
        matrix,
        i,
        j,
        Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]),
      );
    }
  }
  return matrix;
}

/** Worst gap between a solution's distances and the ones asked for. */
function worstGap(matrix: RttMatrix, x: Float64Array, y: Float64Array): number {
  let worst = 0;
  for (let i = 0; i < matrix.size; i += 1) {
    for (let j = i + 1; j < matrix.size; j += 1) {
      const drawn = Math.hypot(x[i] - x[j], y[i] - y[j]);
      worst = Math.max(worst, Math.abs(drawn - matrix.values[i * matrix.size + j]));
    }
  }
  return worst;
}

const ring: [number, number][] = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  return [30 * Math.cos(angle), 30 * Math.sin(angle)];
});

describe("classicalMds", () => {
  it("reproduces a layout it was given the distances of", () => {
    const { x, y } = classicalMds(matrixOf(ring));
    expect(worstGap(matrixOf(ring), x, y)).toBeLessThan(0.01);
  });

  /**
   * The guard on a bug that made the whole map a line. Power iteration finds
   * the eigenvalue of largest magnitude, and this matrix has large negative
   * ones, so without a spectral shift the second axis came back negative, got
   * clamped to zero, and every node landed on the x axis.
   */
  it("returns two real dimensions, not a line", () => {
    const { x, y } = classicalMds(matrixOf(ring));
    const spread = (v: Float64Array) => Math.max(...v) - Math.min(...v);
    expect(spread(y)).toBeGreaterThan(0.5 * spread(x));
  });

  it("survives dissimilarities that are not a metric", () => {
    // One pair is told it is far apart while both its neighbours are close:
    // no arrangement satisfies it, and the solver still has to place them.
    const matrix = matrixOf(ring);
    set(matrix, 0, 1, 500);
    set(matrix, 1, 0, 500);
    const { x, y } = classicalMds(matrix);
    expect([...x, ...y].every(Number.isFinite)).toBe(true);
    const spread = (v: Float64Array) => Math.max(...v) - Math.min(...v);
    expect(spread(y)).toBeGreaterThan(0);
  });
});

describe("smacof", () => {
  it("never makes the fit worse than the layout it started from", () => {
    const matrix = matrixOf(ring);
    const start = {
      x: Float64Array.from(ring.map((_, i) => Math.sin(i) * 40)),
      y: Float64Array.from(ring.map((_, i) => Math.cos(i * 2) * 40)),
    };
    const before = worstGap(matrix, start.x, start.y);
    const after = smacof(matrix, start, { maxIterations: 300 });
    expect(worstGap(matrix, after.x, after.y)).toBeLessThan(before);
  });
});

describe("embed", () => {
  it("recovers a layout from its distances alone", () => {
    const points: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [-8, 3],
      [18, 6],
    ];
    const matrix = matrixOf(points);
    const { x, y } = embed(matrix);
    expect(worstGap(matrix, x, y)).toBeLessThan(0.05);
  });

  it("is deterministic, so two snapshots differ only where the network did", () => {
    const matrix = matrixOf(ring);
    const first = embed(matrix);
    const second = embed(matrix);
    expect([...first.x]).toEqual([...second.x]);
    expect([...first.y]).toEqual([...second.y]);
  });
});
