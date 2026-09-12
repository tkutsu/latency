import { describe, expect, it } from "vitest";
import { isEuropean } from "@/lib/europe";

describe("isEuropean", () => {
  it("keeps the mainland", () => {
    expect(isEuropean("DE", 50.11, 8.68)).toBe(true);
    expect(isEuropean("GR", 37.98, 23.73)).toBe(true);
  });

  it("keeps the interesting edges", () => {
    expect(isEuropean("IS", 64.13, -21.9)).toBe(true);
    expect(isEuropean("CY", 35.17, 33.36)).toBe(true);
    expect(isEuropean("PT", 37.74, -25.67)).toBe(true);
  });

  it("drops overseas territories the country code would let through", () => {
    // Réunion and Guadeloupe are both FR; the Canaries are ES.
    expect(isEuropean("FR", -21.11, 55.53)).toBe(false);
    expect(isEuropean("FR", 16.27, -61.55)).toBe(false);
    expect(isEuropean("ES", 28.13, -15.43)).toBe(false);
  });

  it("cuts Russia and Turkey at the continental divide", () => {
    expect(isEuropean("RU", 55.75, 37.62)).toBe(true);
    expect(isEuropean("RU", 55.03, 82.92)).toBe(false);
    expect(isEuropean("TR", 41.01, 28.98)).toBe(true);
  });

  it("rejects countries that are not European at all", () => {
    expect(isEuropean("US", 40.71, -74.01)).toBe(false);
  });
});
