import { describe, it, expect } from "vitest";
import { SeedDataConnector } from "../lib/connectors/seed-data";

describe("SeedDataConnector", () => {
  const connector = new SeedDataConnector();

  it("has correct name", () => {
    expect(connector.name).toBe("SeedDataConnector");
  });

  it("is enabled by default", () => {
    expect(connector.enabled()).toBe(true);
  });

  it("returns results for Ohio State flag query", async () => {
    const results = await connector.search({
      query: "Ohio State flag",
      zip: "43040",
      latitude: 40.2365,
      longitude: -83.3671,
      radiusMiles: 25,
    });

    expect(results.length).toBeGreaterThan(0);

    // All results should have proper structure
    for (const r of results) {
      expect(r.title).toBeTruthy();
      expect(r.storeName).toBeTruthy();
      expect(r.sourceName).toBe("SeedDataConnector");
      expect(r.evidenceText).toBeTruthy();
      expect(r.lastCheckedAt).toBeInstanceOf(Date);
      expect([
        "IN_STORE_LIKELY",
        "PICKUP_TODAY",
        "PICKUP_ONLY",
        "SHIP_TO_STORE",
        "ONLINE_ONLY",
        "OUT_OF_STOCK",
        "UNKNOWN",
      ]).toContain(r.availabilityStatus);
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(r.confidence);
    }
  });

  it("respects radius filter", async () => {
    const resultsWide = await connector.search({
      query: "Ohio State flag",
      zip: "43040",
      latitude: 40.2365,
      longitude: -83.3671,
      radiusMiles: 50,
    });

    const resultsNarrow = await connector.search({
      query: "Ohio State flag",
      zip: "43040",
      latitude: 40.2365,
      longitude: -83.3671,
      radiusMiles: 5,
    });

    expect(resultsWide.length).toBeGreaterThanOrEqual(resultsNarrow.length);
  });

  it("returns empty for unrelated query", async () => {
    const results = await connector.search({
      query: "xyzzy nonexistent widget",
      zip: "43040",
      latitude: 40.2365,
      longitude: -83.3671,
      radiusMiles: 25,
    });

    expect(results.length).toBe(0);
  });
});
