/** The handful of numbers the map is worth nothing without. */
import type { StressDomain } from "@/lib/palette";
import { median } from "@/lib/stress";
import { quantile } from "@/lib/view";
import type { LatencyNode, Snapshot } from "@/lib/types";

export interface Summary {
  nodeCount: number;
  observedAt: string;
  /** Typical path length as a multiple of the speed of light in fibre. */
  medianDetourRatio: number;
  /** RMS gap between drawn distance and measured RTT, ms. */
  totalStress: number;
  /** Share of pairs some third anchor reaches faster than the direct ping. */
  triangleViolationRate: number;
  /** The stress range the colour ramp spans. */
  stressDomain: StressDomain;
}

export function summarise(snapshot: Snapshot): Summary {
  return {
    nodeCount: snapshot.nodeCount,
    observedAt: snapshot.observedAt,
    medianDetourRatio: median(snapshot.nodes.map((node) => node.detourRatio)),
    totalStress: snapshot.totalStress,
    triangleViolationRate: snapshot.triangleViolationRate,
    stressDomain: stressDomain(snapshot.nodes),
  };
}

/**
 * The middle 90% of the stress distribution, rounded to whole milliseconds.
 *
 * Clipping both tails is what keeps the ramp legible: one unplaceable anchor
 * would otherwise compress every real difference into the bottom step, and
 * starting from zero would waste a third of the ramp on a range no node
 * occupies.
 */
export function stressDomain(nodes: LatencyNode[]): StressDomain {
  if (nodes.length === 0) return { low: 0, high: 10 };
  const stresses = nodes.map((node) => node.stress);
  const low = Math.floor(quantile(stresses, 0.05));
  return { low, high: Math.max(low + 1, Math.ceil(quantile(stresses, 0.95))) };
}
