import { describe, it, expect } from "vitest";
import { geocodeZip, distanceMiles } from "../lib/geo";

describe("geocodeZip", () => {
  it("returns coords for known ZIP 43040", () => {
    const result = geocodeZip("43040");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(40.2365, 2);
    expect(result!.lng).toBeCloseTo(-83.3671, 2);
  });

  it("returns null for unknown ZIP", () => {
    expect(geocodeZip("99999")).toBeNull();
  });
});

describe("distanceMiles", () => {
  it("returns 0 for same point", () => {
    expect(distanceMiles(40.0, -83.0, 40.0, -83.0)).toBe(0);
  });

  it("calculates distance between Marysville and Dublin OH", () => {
    // Marysville (40.2365, -83.3671) to Dublin (40.0992, -83.1538)
    const dist = distanceMiles(40.2365, -83.3671, 40.0992, -83.1538);
    // Should be ~15-16 miles
    expect(dist).toBeGreaterThan(13);
    expect(dist).toBeLessThan(18);
  });

  it("short distances are reasonable", () => {
    // Two points about 1 mile apart
    const dist = distanceMiles(40.2365, -83.3671, 40.2365, -83.3525);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2);
  });
});
