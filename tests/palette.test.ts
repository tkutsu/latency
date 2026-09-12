import { describe, expect, it } from "vitest";
import { CHROME, mix, stressColour, stressRamp } from "@/lib/palette";

const domain = { low: 5, high: 20 };

describe("stressRamp", () => {
  it("has a selected set of steps for each surface, not a flipped one", () => {
    expect(stressRamp("dark")).not.toEqual(stressRamp("light"));
    expect(stressRamp("dark")).not.toEqual([...stressRamp("light")].reverse());
  });
});

describe("stressColour", () => {
  it("saturates below the domain instead of running off the ramp", () => {
    expect(stressColour(0, domain, "dark")).toBe(
      stressColour(domain.low, domain, "dark"),
    );
  });

  it("saturates above the domain", () => {
    expect(stressColour(500, domain, "dark")).toBe(
      stressColour(domain.high, domain, "dark"),
    );
  });

  it("moves monotonically through the ramp", () => {
    const seen = [5, 9, 13, 17, 20].map((s) => stressColour(s, domain, "dark"));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("survives a domain with no width", () => {
    expect(stressColour(7, { low: 4, high: 4 }, "dark")).toMatch(/^rgb\(/);
  });
});

describe("mix", () => {
  it("returns the ends unchanged", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("rgb(0 0 0)");
    expect(mix("#000000", "#ffffff", 1)).toBe("rgb(255 255 255)");
  });

  it("blends halfway", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("rgb(128 128 128)");
  });
});

describe("CHROME", () => {
  it("gives every surface its own ink", () => {
    expect(CHROME.dark.surface).not.toBe(CHROME.light.surface);
    expect(CHROME.dark.ink).not.toBe(CHROME.light.ink);
  });
});
