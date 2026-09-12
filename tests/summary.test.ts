import { describe, expect, it } from "vitest";
import { stressDomain, summarise } from "@/lib/summary";
import type { LatencyNode, Snapshot } from "@/lib/types";

function nodes(stresses: number[], ratios: number[] = []): LatencyNode[] {
  return stresses.map(
    (stress, i) =>
      ({ stress, detourRatio: ratios[i] ?? 2.5 }) as LatencyNode,
  );
}

describe("stressDomain", () => {
  it("spans the middle of the distribution", () => {
    const domain = stressDomain(nodes([4, 5, 6, 7, 8, 9, 10]));
    expect(domain.low).toBe(4);
    expect(domain.high).toBe(10);
  });

  it("is not dragged out by a single unplaceable anchor", () => {
    const spread = Array.from({ length: 100 }, (_, i) => 5 + i * 0.1);
    const domain = stressDomain(nodes([...spread, 900]));
    expect(domain.high).toBeLessThan(20);
  });

  it("always has width, even if every node fits identically", () => {
    const domain = stressDomain(nodes([7, 7, 7]));
    expect(domain.high).toBeGreaterThan(domain.low);
  });

  it("copes with no nodes at all", () => {
    expect(stressDomain([]).high).toBeGreaterThan(stressDomain([]).low);
  });
});

describe("summarise", () => {
  it("carries the snapshot's own figures through untouched", () => {
    const snapshot = {
      observedAt: "2026-09-12T00:00:00.000Z",
      nodeCount: 3,
      totalStress: 11.7,
      triangleViolationRate: 0.83,
      nodes: nodes([5, 9, 14], [2.1, 2.6, 3.4]),
    } as Snapshot;
    const summary = summarise(snapshot);
    expect(summary.totalStress).toBe(11.7);
    expect(summary.triangleViolationRate).toBe(0.83);
    expect(summary.medianDetourRatio).toBe(2.6);
    expect(summary.nodeCount).toBe(3);
  });
});
