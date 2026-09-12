import { describe, expect, it } from "vitest";
import {
  completeByShortestPath,
  countMeasuredPairs,
  createMatrix,
  get,
  set,
  submatrix,
  symmetrise,
  triangleViolationRate,
  wellCoveredIndices,
} from "@/lib/matrix";

function directed(size: number, entries: [number, number, number][]) {
  const matrix = createMatrix(size);
  for (const [i, j, value] of entries) set(matrix, i, j, value);
  return matrix;
}

describe("createMatrix", () => {
  it("starts unknown everywhere but the diagonal", () => {
    const matrix = createMatrix(3);
    expect(get(matrix, 0, 0)).toBe(0);
    expect(Number.isNaN(get(matrix, 0, 1))).toBe(true);
  });
});

describe("symmetrise", () => {
  it("takes the smaller of the two directions", () => {
    const matrix = symmetrise(
      directed(2, [
        [0, 1, 12],
        [1, 0, 8],
      ]),
    );
    expect(get(matrix, 0, 1)).toBe(8);
    expect(get(matrix, 1, 0)).toBe(8);
  });

  it("keeps a pair measured in one direction only", () => {
    const matrix = symmetrise(directed(2, [[0, 1, 12]]));
    expect(get(matrix, 1, 0)).toBe(12);
  });

  it("leaves a pair with no measurement unknown", () => {
    const matrix = symmetrise(directed(2, []));
    expect(Number.isNaN(get(matrix, 0, 1))).toBe(true);
  });
});

describe("wellCoveredIndices", () => {
  it("drops nodes measured against too few others", () => {
    const matrix = symmetrise(
      directed(4, [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [1, 2, 1],
        [1, 3, 1],
        [2, 3, 1],
      ]),
    );
    // Node 3 keeps only one of its three pairs.
    set(matrix, 3, 1, Number.NaN);
    set(matrix, 1, 3, Number.NaN);
    set(matrix, 3, 2, Number.NaN);
    set(matrix, 2, 3, Number.NaN);
    expect(wellCoveredIndices(matrix, 0.6)).toEqual([0, 1, 2]);
  });
});

describe("submatrix", () => {
  it("keeps the given rows and columns, in order", () => {
    const matrix = symmetrise(
      directed(3, [
        [0, 2, 5],
        [0, 1, 9],
      ]),
    );
    const kept = submatrix(matrix, [2, 0]);
    expect(kept.size).toBe(2);
    expect(get(kept, 0, 1)).toBe(5);
  });
});

describe("countMeasuredPairs", () => {
  it("counts each pair once", () => {
    expect(
      countMeasuredPairs(
        symmetrise(
          directed(3, [
            [0, 1, 4],
            [1, 2, 4],
          ]),
        ),
      ),
    ).toBe(2);
  });
});

describe("completeByShortestPath", () => {
  it("fills a gap with the best path through the graph", () => {
    const matrix = symmetrise(
      directed(3, [
        [0, 1, 4],
        [1, 2, 6],
      ]),
    );
    expect(get(completeByShortestPath(matrix), 0, 2)).toBe(10);
  });

  it("leaves measured pairs alone even when a detour beats them", () => {
    // 0→2 measures 30 while 0→1→2 adds to 10: a triangle violation, and
    // exactly the thing the embedding has to be told about rather than have
    // quietly smoothed away.
    const matrix = symmetrise(
      directed(3, [
        [0, 1, 4],
        [1, 2, 6],
        [0, 2, 30],
      ]),
    );
    expect(get(completeByShortestPath(matrix), 0, 2)).toBe(30);
  });

  it("refuses a disconnected graph", () => {
    const matrix = symmetrise(directed(3, [[0, 1, 4]]));
    expect(() => completeByShortestPath(matrix)).toThrow(/disconnected/);
  });
});

describe("triangleViolationRate", () => {
  it("is zero when every pair is its own shortest path", () => {
    const matrix = symmetrise(
      directed(3, [
        [0, 1, 4],
        [1, 2, 6],
        [0, 2, 9],
      ]),
    );
    expect(triangleViolationRate(matrix)).toBe(0);
  });

  it("catches the pair a third node beats", () => {
    const matrix = symmetrise(
      directed(3, [
        [0, 1, 4],
        [1, 2, 6],
        [0, 2, 30],
      ]),
    );
    expect(triangleViolationRate(matrix)).toBeCloseTo(1 / 3, 10);
  });
});
