import { describe, expect, it } from "vitest";
import { alignTo } from "@/lib/align";
import type { Coordinates } from "@/lib/mds";

const target: Coordinates = {
  x: Float64Array.from([0, 10, 10, 0, 4]),
  y: Float64Array.from([0, 0, 8, 8, 3]),
};

function rotate(source: Coordinates, angle: number, mirror = false): Coordinates {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = new Float64Array(source.x.length);
  const y = new Float64Array(source.y.length);
  for (let i = 0; i < x.length; i += 1) {
    const sx = source.x[i];
    const sy = mirror ? -source.y[i] : source.y[i];
    x[i] = cos * sx - sin * sy;
    y[i] = sin * sx + cos * sy;
  }
  return { x, y };
}

function worstOffset(a: Coordinates, b: Coordinates): number {
  let worst = 0;
  for (let i = 0; i < a.x.length; i += 1) {
    worst = Math.max(worst, Math.hypot(a.x[i] - b.x[i], a.y[i] - b.y[i]));
  }
  return worst;
}

describe("alignTo", () => {
  it("undoes a rotation", () => {
    const spun = rotate(target, 1.1);
    const { coordinates, alignment } = alignTo(spun, target);
    expect(alignment.reflected).toBe(false);
    expect(worstOffset(coordinates, target)).toBeLessThan(1e-9);
  });

  it("undoes a mirrored rotation", () => {
    const flipped = rotate(target, -0.4, true);
    const { coordinates, alignment } = alignTo(flipped, target);
    expect(alignment.reflected).toBe(true);
    expect(worstOffset(coordinates, target)).toBeLessThan(1e-9);
  });

  it("leaves distances alone: it never rescales", () => {
    const spun = rotate(target, 0.6);
    // Twice the size, which alignment must not undo — the embedding is in
    // milliseconds and stretching it would hide how much wider latency is.
    const doubled = {
      x: Float64Array.from(spun.x, (v) => v * 2),
      y: Float64Array.from(spun.y, (v) => v * 2),
    };
    const { coordinates } = alignTo(doubled, target);
    const span = (c: Coordinates) => Math.hypot(c.x[1] - c.x[0], c.y[1] - c.y[0]);
    expect(span(coordinates)).toBeCloseTo(2 * span(target), 9);
  });

  it("is stable: aligning an already-aligned layout changes nothing", () => {
    const once = alignTo(rotate(target, 2.4), target).coordinates;
    const twice = alignTo(once, target).coordinates;
    expect(worstOffset(once, twice)).toBeLessThan(1e-9);
  });
});
