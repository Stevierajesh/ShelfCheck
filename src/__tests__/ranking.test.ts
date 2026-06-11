import { describe, it, expect } from "vitest";
import { SearchResult, AvailabilityStatus } from "../lib/types";

// Replicate the ranking logic for unit testing
const AVAILABILITY_PRIORITY: Record<AvailabilityStatus, number> = {
  IN_STORE_LIKELY: 0,
  PICKUP_TODAY: 1,
  PICKUP_ONLY: 2,
  UNKNOWN: 3,
  SHIP_TO_STORE: 4,
  ONLINE_ONLY: 5,
  OUT_OF_STOCK: 6,
};

const CONFIDENCE_PRIORITY: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

function rankResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    const aPri = AVAILABILITY_PRIORITY[a.availabilityStatus] ?? 99;
    const bPri = AVAILABILITY_PRIORITY[b.availabilityStatus] ?? 99;
    if (aPri !== bPri) return aPri - bPri;
    if (a.distance !== b.distance) return a.distance - b.distance;
    const aCon = CONFIDENCE_PRIORITY[a.confidence] ?? 99;
    const bCon = CONFIDENCE_PRIORITY[b.confidence] ?? 99;
    return aCon - bCon;
  });
}

function makeResult(
  overrides: Partial<SearchResult>
): SearchResult {
  return {
    id: "test",
    title: "Test Product",
    brand: null,
    category: null,
    price: null,
    productUrl: null,
    imageUrl: null,
    storeName: "Test Store",
    retailer: "Test",
    address: "123 Main",
    city: "Marysville",
    state: "OH",
    zip: "43040",
    phone: null,
    distance: 5,
    availabilityStatus: "UNKNOWN",
    confidence: "LOW",
    evidenceText: "test",
    lastCheckedAt: new Date().toISOString(),
    sourceName: "test",
    storeId: "s1",
    productId: "p1",
    offerId: "o1",
    ...overrides,
  };
}

describe("result ranking", () => {
  it("sorts IN_STORE_LIKELY before ONLINE_ONLY", () => {
    const results = rankResults([
      makeResult({ id: "a", availabilityStatus: "ONLINE_ONLY", distance: 1 }),
      makeResult({ id: "b", availabilityStatus: "IN_STORE_LIKELY", distance: 10 }),
    ]);
    expect(results[0].id).toBe("b");
  });

  it("sorts PICKUP_TODAY before UNKNOWN", () => {
    const results = rankResults([
      makeResult({ id: "a", availabilityStatus: "UNKNOWN" }),
      makeResult({ id: "b", availabilityStatus: "PICKUP_TODAY" }),
    ]);
    expect(results[0].id).toBe("b");
  });

  it("sorts by distance when availability is equal", () => {
    const results = rankResults([
      makeResult({ id: "a", availabilityStatus: "IN_STORE_LIKELY", distance: 10 }),
      makeResult({ id: "b", availabilityStatus: "IN_STORE_LIKELY", distance: 2 }),
    ]);
    expect(results[0].id).toBe("b");
  });

  it("sorts by confidence when availability and distance are equal", () => {
    const results = rankResults([
      makeResult({
        id: "a",
        availabilityStatus: "IN_STORE_LIKELY",
        distance: 5,
        confidence: "LOW",
      }),
      makeResult({
        id: "b",
        availabilityStatus: "IN_STORE_LIKELY",
        distance: 5,
        confidence: "HIGH",
      }),
    ]);
    expect(results[0].id).toBe("b");
  });

  it("OUT_OF_STOCK sorts last", () => {
    const results = rankResults([
      makeResult({ id: "a", availabilityStatus: "OUT_OF_STOCK" }),
      makeResult({ id: "b", availabilityStatus: "UNKNOWN" }),
      makeResult({ id: "c", availabilityStatus: "ONLINE_ONLY" }),
    ]);
    expect(results[results.length - 1].id).toBe("a");
  });
});

describe("availability status mapping", () => {
  it("priority order is correct", () => {
    const order: AvailabilityStatus[] = [
      "IN_STORE_LIKELY",
      "PICKUP_TODAY",
      "PICKUP_ONLY",
      "UNKNOWN",
      "SHIP_TO_STORE",
      "ONLINE_ONLY",
      "OUT_OF_STOCK",
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(AVAILABILITY_PRIORITY[order[i]]).toBeLessThan(
        AVAILABILITY_PRIORITY[order[i + 1]]
      );
    }
  });
});
