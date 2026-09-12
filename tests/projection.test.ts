import { describe, expect, it } from "vitest";
import {
  centreOf,
  fibreFloorMs,
  haversineKm,
  KM_PER_MS,
  projectToMs,
} from "@/lib/projection";

describe("haversineKm", () => {
  it("measures a known great circle", () => {
    // Amsterdam to Athens, about 2,160 km.
    const km = haversineKm(52.3676, 4.9041, 37.9838, 23.7275);
    expect(km).toBeGreaterThan(2100);
    expect(km).toBeLessThan(2220);
  });

  it("is zero for a point against itself", () => {
    expect(haversineKm(50, 10, 50, 10)).toBe(0);
  });
});

describe("fibreFloorMs", () => {
  it("puts 100 km at one millisecond of round trip", () => {
    expect(fibreFloorMs(KM_PER_MS)).toBeCloseTo(1, 10);
  });
});

describe("projectToMs", () => {
  const centre = { latitude: 50, longitude: 10 };

  it("puts the centre at the origin", () => {
    const point = projectToMs(50, 10, centre);
    expect(point.x).toBeCloseTo(0, 9);
    expect(point.y).toBeCloseTo(0, 9);
  });

  it("preserves distance from the centre, in ms", () => {
    const km = haversineKm(50, 10, 37.9838, 23.7275);
    const point = projectToMs(37.9838, 23.7275, centre);
    expect(Math.hypot(point.x, point.y)).toBeCloseTo(km / KM_PER_MS, 6);
  });

  it("draws north upward, which is negative y on a screen", () => {
    expect(projectToMs(60, 10, centre).y).toBeLessThan(0);
    expect(projectToMs(40, 10, centre).y).toBeGreaterThan(0);
    expect(projectToMs(50, 20, centre).x).toBeGreaterThan(0);
  });
});

describe("centreOf", () => {
  it("averages the coordinates", () => {
    expect(
      centreOf([
        { latitude: 40, longitude: 0 },
        { latitude: 60, longitude: 20 },
      ]),
    ).toEqual({ latitude: 50, longitude: 10 });
  });
});
