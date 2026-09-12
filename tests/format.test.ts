import { describe, expect, it } from "vitest";
import { asn, km, ms, observedOn, percent, times } from "@/lib/format";

describe("format", () => {
  it("writes milliseconds to one decimal", () => {
    expect(ms(11.735)).toBe("11.7 ms");
  });

  it("writes a ratio with its multiplication sign", () => {
    expect(times(2.6)).toBe("2.60×");
  });

  it("rounds a share to whole percent", () => {
    expect(percent(0.832)).toBe("83%");
  });

  it("groups thousands of kilometres", () => {
    expect(km(2163.4)).toBe("2,163 km");
  });

  it("names an unknown autonomous system rather than printing null", () => {
    expect(asn(null)).toBe("unknown AS");
    expect(asn(3320)).toBe("AS3320");
  });

  it("writes the observation date long", () => {
    expect(observedOn("2026-09-12T08:51:44.158Z")).toBe("12 September 2026");
  });
});
