import { describe, expect, it } from "vitest";
import type { LatencyNode } from "@/lib/types";
import {
  apply,
  boundsOf,
  fitTransform,
  framedBounds,
  placeAll,
  positionAt,
  quantile,
} from "@/lib/view";

function node(geographic: [number, number], embedded: [number, number]) {
  return {
    geographic: { x: geographic[0], y: geographic[1] },
    embedded: { x: embedded[0], y: embedded[1] },
  } as LatencyNode;
}

describe("positionAt", () => {
  const subject = node([0, 0], [10, 20]);

  it("is geography at zero and latency at one", () => {
    expect(positionAt(subject, 0)).toEqual({ x: 0, y: 0 });
    expect(positionAt(subject, 1)).toEqual({ x: 10, y: 20 });
  });

  it("blends linearly in between", () => {
    expect(positionAt(subject, 0.25)).toEqual({ x: 2.5, y: 5 });
  });
});

describe("boundsOf", () => {
  it("spans the points", () => {
    expect(
      boundsOf([
        { x: -2, y: 5 },
        { x: 7, y: -1 },
      ]),
    ).toEqual({ minX: -2, maxX: 7, minY: -1, maxY: 5 });
  });
});

describe("framedBounds", () => {
  const bulk = Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: i % 10 }));

  it("holds everything when nothing is an outlier", () => {
    const bounds = framedBounds(bulk, 0.99);
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(9);
  });

  it("does not let one far-flung node set the frame", () => {
    const bounds = framedBounds([...bulk, { x: 5000, y: 0 }], 0.98);
    expect(bounds.maxX).toBeLessThan(20);
  });

  it("keeps the bulk centred rather than following the outlier", () => {
    const bounds = framedBounds([...bulk, { x: 5000, y: 0 }], 0.98);
    const centre = (bounds.minX + bounds.maxX) / 2;
    expect(centre).toBeGreaterThan(3);
    expect(centre).toBeLessThan(6);
  });
});

describe("fitTransform", () => {
  const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

  it("centres the content in the box", () => {
    const transform = fitTransform(bounds, 200, 100, 10);
    const centre = apply({ x: 5, y: 5 }, transform);
    expect(centre.x).toBeCloseTo(100, 9);
    expect(centre.y).toBeCloseTo(50, 9);
  });

  it("uses one scale for both axes, so the shape is not distorted", () => {
    const transform = fitTransform(bounds, 400, 100, 10);
    // Height is the binding constraint: (100 - 20) / 10.
    expect(transform.scale).toBeCloseTo(8, 9);
  });

  it("survives a degenerate span", () => {
    const flat = fitTransform({ minX: 3, maxX: 3, minY: 3, maxY: 3 }, 100, 100, 5);
    expect(Number.isFinite(flat.scale)).toBe(true);
  });
});

describe("placeAll", () => {
  const transform = { scale: 1, offsetX: 0, offsetY: 0 };

  it("leaves a node inside the frame where it is", () => {
    const [placement] = placeAll([{ x: 50, y: 50 }], transform, 100, 100, 7);
    expect(placement.beyond).toBe(false);
    expect(placement.point).toEqual({ x: 50, y: 50 });
  });

  it("pins a node outside the frame to the edge and says so", () => {
    const [placement] = placeAll([{ x: 500, y: 50 }], transform, 100, 100, 7);
    expect(placement.beyond).toBe(true);
    expect(placement.point.x).toBe(93);
  });
});

describe("quantile", () => {
  it("takes the ends at 0 and 1", () => {
    const values = [5, 1, 9, 3];
    expect(quantile(values, 0)).toBe(1);
    expect(quantile(values, 1)).toBe(9);
  });

  it("does not mutate its input", () => {
    const values = [5, 1, 9];
    quantile(values, 0.5);
    expect(values).toEqual([5, 1, 9]);
  });
});
