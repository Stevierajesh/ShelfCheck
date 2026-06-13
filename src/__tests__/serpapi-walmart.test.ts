import { describe, it, expect, vi, beforeEach } from "vitest";
import { SerpApiWalmartConnector } from "../lib/connectors/serpapi-walmart";

describe("SerpApiWalmartConnector", () => {
  const connector = new SerpApiWalmartConnector();

  it("has correct name", () => {
    expect(connector.name).toBe("SerpApiWalmartConnector");
  });

  it("is disabled without env vars", () => {
    expect(connector.enabled()).toBe(false);
  });

  it("is disabled with API key but no enable flag", () => {
    process.env.SERPAPI_API_KEY = "test-key";
    expect(connector.enabled()).toBe(false);
    delete process.env.SERPAPI_API_KEY;
  });

  it("is enabled with both API key and enable flag", () => {
    process.env.SERPAPI_API_KEY = "test-key";
    process.env.ENABLE_SERPAPI_WALMART_CONNECTOR = "true";
    expect(connector.enabled()).toBe(true);
    delete process.env.SERPAPI_API_KEY;
    delete process.env.ENABLE_SERPAPI_WALMART_CONNECTOR;
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
      process.env.ENABLE_SERPAPI_WALMART_CONNECTOR = "true";
    });

    it("parses search results with fulfillment flags", async () => {
      const mockSearchResponse = {
        organic_results: [
          {
            us_item_id: "123456",
            title: "Ohio State Buckeyes 3x5 Flag",
            thumbnail: "https://example.com/flag.jpg",
            primary_offer: {
              offer_price: 19.99,
              offer_id: "offer-1",
            },
            fulfillment: {
              pickup_today: true,
              free_shipping: true,
            },
            product_page_url: "/ip/Ohio-State-Flag/123456",
          },
          {
            us_item_id: "789012",
            title: "Ohio State Garden Flag",
            primary_offer: {
              offer_price: 9.99,
            },
            fulfillment: {
              free_shipping: true,
            },
            product_page_url: "/ip/Ohio-State-Garden-Flag/789012",
          },
        ],
      };

      const mockDetailPickup = {
        product_result: {
          us_item_id: "123456",
          title: "Ohio State Buckeyes 3x5 Flag",
          brand: "WinCraft",
          categories: [{ name: "Sports" }, { name: "Flags & Banners" }],
          price_map: { price: 19.99 },
          product_page_url: "/ip/Ohio-State-Flag/123456",
        },
        fulfillment: {
          pickup: [
            {
              available: true,
              store_name: "Walmart Supercenter",
              store_address: "555 Coleman's Crossing Blvd, Marysville, OH 43040",
              availability_status: "In Stock",
            },
          ],
          shipping: { available: true, arrival_date: "Jun 15" },
        },
      };

      const mockDetailShipOnly = {
        product_result: {
          us_item_id: "789012",
          title: "Ohio State Garden Flag",
          brand: "Generic",
          categories: [{ name: "Flags" }],
          price_map: { price: 9.99 },
          product_page_url: "/ip/Ohio-State-Garden-Flag/789012",
        },
        fulfillment: {
          shipping: { available: true, arrival_date: "Jun 16" },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        async (url) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("engine=walmart_product") && urlStr.includes("789012")) {
            return new Response(JSON.stringify(mockDetailShipOnly), {
              status: 200,
            });
          }
          if (urlStr.includes("engine=walmart_product")) {
            return new Response(JSON.stringify(mockDetailPickup), {
              status: 200,
            });
          }
          return new Response(JSON.stringify(mockSearchResponse), {
            status: 200,
          });
        }
      );

      const results = await connector.search({
        query: "Ohio State flag",
        zip: "43040",
        latitude: 40.2365,
        longitude: -83.3671,
        radiusMiles: 50,
      });

      expect(results.length).toBeGreaterThan(0);

      // First result should have detail-enriched data
      const first = results[0];
      expect(first.title).toBe("Ohio State Buckeyes 3x5 Flag");
      expect(first.brand).toBe("WinCraft");
      expect(first.category).toBe("Flags & Banners");
      expect(first.price).toBe(19.99);
      expect(first.retailer).toBe("Walmart");
      expect(first.availabilityStatus).toBe("PICKUP_TODAY");
      expect(first.confidence).toBe("HIGH");
      expect(first.sourceName).toBe("SerpApiWalmartConnector");
      expect(first.evidenceText).toContain("Walmart");
      expect(first.evidenceText).toContain("pickup");

      // Second result should have search-level data only (online)
      const second = results[1];
      expect(second.availabilityStatus).toBe("ONLINE_ONLY");

      fetchSpy.mockRestore();
      delete process.env.SERPAPI_API_KEY;
      delete process.env.ENABLE_SERPAPI_WALMART_CONNECTOR;
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
      delete process.env.SERPAPI_API_KEY;
      delete process.env.ENABLE_SERPAPI_WALMART_CONNECTOR;
    });
  });
});
