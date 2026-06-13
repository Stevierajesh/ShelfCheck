import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SerpApiShoppingConnector } from "../lib/connectors/serpapi-shopping";

describe("SerpApiShoppingConnector", () => {
  const connector = new SerpApiShoppingConnector();

  it("has correct name", () => {
    expect(connector.name).toBe("SerpApiShoppingConnector");
  });

  it("is disabled without env vars", () => {
    expect(connector.enabled()).toBe(false);
  });

  it("is enabled with API key and enable flag", () => {
    process.env.SERPAPI_API_KEY = "test-key";
    process.env.ENABLE_SERPAPI_SHOPPING_CONNECTOR = "true";
    expect(connector.enabled()).toBe(true);
    delete process.env.SERPAPI_API_KEY;
    delete process.env.ENABLE_SERPAPI_SHOPPING_CONNECTOR;
  });

  it("returns empty array when no API key is set", async () => {
    const results = await connector.search({
      query: "Ohio State flag",
      zip: "43040",
      latitude: 40.2365,
      longitude: -83.3671,
      radiusMiles: 25,
    });
    expect(results).toEqual([]);
  });

  describe("with mocked fetch", () => {
    beforeEach(() => {
      process.env.SERPAPI_API_KEY = "test-key";
      process.env.ENABLE_SERPAPI_SHOPPING_CONNECTOR = "true";
    });

    afterEach(() => {
      delete process.env.SERPAPI_API_KEY;
      delete process.env.ENABLE_SERPAPI_SHOPPING_CONNECTOR;
    });

    it("parses shopping results from multiple retailers", async () => {
      const mockResponse = {
        shopping_results: [
          {
            product_id: "p1",
            title: "Ohio State Buckeyes 3x5 Flag",
            source: "Walmart",
            extracted_price: 19.99,
            link: "https://walmart.com/ip/flag/123",
            thumbnail: "https://example.com/flag.jpg",
            delivery: "Pickup today",
          },
          {
            product_id: "p2",
            title: "Ohio State Garden Flag",
            source: "Target",
            extracted_price: 12.99,
            link: "https://target.com/flag/456",
            delivery: "Free delivery",
          },
          {
            product_id: "p3",
            title: "OSU Buckeyes Banner",
            source: "Dick's Sporting Goods",
            extracted_price: 24.99,
            link: "https://dickssportinggoods.com/flag/789",
            badge: "In stock at nearby store",
          },
          {
            product_id: "p4",
            title: "Ohio State Flag - Out of Stock",
            source: "Fanatics",
            extracted_price: 29.99,
            delivery: "Unavailable",
          },
        ],
        local_shopping_results: [
          {
            title: "Ohio State House Flag",
            source: "Rally House",
            store_name: "Rally House Columbus",
            extracted_price: 22.99,
            in_stock: true,
            nearby_store: {
              name: "Rally House Columbus",
              address: "1576 Polaris Pkwy, Columbus, OH",
              phone: "(614) 468-4870",
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        async () =>
          new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const results = await connector.search({
        query: "Ohio State flag",
        zip: "43040",
        latitude: 40.2365,
        longitude: -83.3671,
        radiusMiles: 50,
      });

      // Should have results from multiple retailers (deduped across the two queries)
      expect(results.length).toBeGreaterThan(0);

      // All results should have correct source name
      for (const r of results) {
        expect(r.sourceName).toBe("SerpApiShoppingConnector");
      }

      // Find Walmart result - should be PICKUP_TODAY
      const walmart = results.find((r) => r.retailer === "Walmart");
      expect(walmart).toBeDefined();
      expect(walmart!.availabilityStatus).toBe("PICKUP_TODAY");
      expect(walmart!.price).toBe(19.99);

      // Find Target result - should be ONLINE_ONLY (delivery only)
      const target = results.find((r) => r.retailer === "Target");
      expect(target).toBeDefined();
      expect(target!.availabilityStatus).toBe("ONLINE_ONLY");

      // Find Dick's result - should be IN_STORE_LIKELY (badge says "in stock at nearby store")
      const dicks = results.find((r) => r.retailer === "Dick's Sporting Goods");
      expect(dicks).toBeDefined();
      expect(dicks!.availabilityStatus).toBe("IN_STORE_LIKELY");

      // Find Rally House local result - should be IN_STORE_LIKELY (in_stock: true)
      const rally = results.find((r) => r.retailer === "Rally House");
      expect(rally).toBeDefined();
      expect(rally!.availabilityStatus).toBe("IN_STORE_LIKELY");
      expect(rally!.phone).toBe("(614) 468-4870");
      expect(rally!.address).toBe("1576 Polaris Pkwy, Columbus, OH");

      fetchSpy.mockRestore();
    });

    it("deduplicates results from the two queries", async () => {
      const mockResponse = {
        shopping_results: [
          {
            product_id: "p1",
            title: "Ohio State Flag",
            source: "Walmart",
            extracted_price: 19.99,
          },
          {
            product_id: "p1",
            title: "Ohio State Flag",
            source: "Walmart",
            extracted_price: 19.99,
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        async () =>
          new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const results = await connector.search({
        query: "Ohio State flag",
        zip: "43040",
        latitude: 40.2365,
        longitude: -83.3671,
        radiusMiles: 25,
      });

      // Same title + same retailer should be deduped
      const walmartResults = results.filter((r) => r.retailer === "Walmart");
      expect(walmartResults.length).toBe(1);

      fetchSpy.mockRestore();
    });

    it("handles API failure gracefully", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        async () => new Response("", { status: 500 })
      );

      const results = await connector.search({
        query: "Ohio State flag",
        zip: "43040",
        latitude: 40.2365,
        longitude: -83.3671,
        radiusMiles: 25,
      });

      expect(results).toEqual([]);

      fetchSpy.mockRestore();
    });
  });
});
