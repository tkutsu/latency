import { describe, expect, it } from "vitest";
import { landmarkLabels, normaliseCity } from "@/lib/labels";
import type { LatencyNode } from "@/lib/types";

function node(city: string, stress: number, id: number): LatencyNode {
  return { city, stress, id, hostname: `anchor-${id}` } as LatencyNode;
}

describe("normaliseCity", () => {
  it("folds case and accents together", () => {
    expect(normaliseCity(" Düsseldorf ")).toBe("dusseldorf");
    expect(normaliseCity("Reykjavík")).toBe("reykjavik");
  });
});

describe("landmarkLabels", () => {
  it("matches the ways Atlas spells a city", () => {
    const labels = landmarkLabels([
      node("Frankfurt am Main", 8, 1),
      node("Milano", 8, 2),
      node("Kiev", 8, 3),
    ]);
    expect(labels.map((label) => label.text).sort()).toEqual([
      "Frankfurt",
      "Kyiv",
      "Milan",
    ]);
  });

  it("puts the label on the anchor the map fits best", () => {
    const nodes = [node("Athens", 22, 1), node("Athens", 6, 2)];
    const [label] = landmarkLabels(nodes);
    expect(nodes[label.index].id).toBe(2);
  });

  it("skips a landmark with no anchor in it", () => {
    expect(landmarkLabels([node("Bensheim", 5, 1)])).toEqual([]);
  });

  it("does not match a city that merely contains the name", () => {
    expect(landmarkLabels([node("New London", 5, 1)])).toEqual([]);
  });
});
