/**
 * Turning two layouts and a slider into pixels.
 *
 * The frame is refitted to whatever the slider currently shows, rather than to
 * the union of both layouts. Latency space is about two and a half times wider
 * than geography, so a fixed frame would spend the morph zooming out and the
 * deformation — which is the whole point — would be lost inside a uniform
 * scale change. Refitting holds the cloud at the same size throughout, so what
 * moves on screen is what genuinely changes shape: the core collapsing, the
 * edges flinging out. The overall factor is a single number, and a number
 * belongs in the readout, not in the animation.
 */
import type { LatencyNode, Point } from "@/lib/types";

/** Where a node sits at a given point in the morph. 0 geography, 1 latency. */
export function positionAt(node: LatencyNode, morph: number): Point {
  return {
    x: node.geographic.x + (node.embedded.x - node.geographic.x) * morph,
    y: node.geographic.y + (node.embedded.y - node.geographic.y) * morph,
  };
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function boundsOf(points: Point[]): Bounds {
  if (points.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, maxX, minY, maxY };
}

export interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fit bounds into a box, preserving aspect so the shape is not distorted. */
export function fitTransform(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
): Transform {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(usableWidth / spanX, usableHeight / spanY);
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offsetX: width / 2 - centreX * scale,
    offsetY: height / 2 - centreY * scale,
  };
}

export function apply(point: Point, transform: Transform): Point {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

/**
 * The frame the map is drawn in: the middle `reach` of the nodes on each axis.
 *
 * Framing to the extremes instead makes the map unreadable, and in two
 * different ways. Centre it on the midpoint of the extremes and a couple of
 * unplaceable anchors drag the centre off the continent, shoving everything
 * into a corner. Centre it on the median and size it symmetrically and half the
 * frame is empty, because the far-flung nodes are all on one side.
 *
 * So the frame follows the bulk, and the handful outside it are pinned to the
 * edge rather than dropped — see the renderer. They are the highest-stress
 * nodes on the map, so losing them would lose the point.
 */
export function framedBounds(points: Point[], reach: number): Bounds {
  if (points.length === 0) return boundsOf(points);
  const tail = (1 - reach) / 2;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: quantile(xs, tail),
    maxX: quantile(xs, 1 - tail),
    minY: quantile(ys, tail),
    maxY: quantile(ys, 1 - tail),
  };
}

/** The quantile of a list, sorted on demand. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.round(q * (sorted.length - 1));
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

/** Where a node is drawn, and whether that is really where it is. */
export interface Placement {
  point: Point;
  /** True when the node sits outside the frame and has been pinned to its edge. */
  beyond: boolean;
}

/** Screen positions, with anything off-frame pinned to the nearest edge. */
export function placeAll(
  points: Point[],
  transform: Transform,
  width: number,
  height: number,
  inset: number,
): Placement[] {
  return points.map((point) => {
    const screen = apply(point, transform);
    const x = Math.min(width - inset, Math.max(inset, screen.x));
    const y = Math.min(height - inset, Math.max(inset, screen.y));
    return { point: { x, y }, beyond: x !== screen.x || y !== screen.y };
  });
}
