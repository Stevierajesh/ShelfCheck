import {
  ProductSearchConnector,
  SearchInput,
  NormalizedInventoryResult,
  AvailabilityStatus,
} from "../types";

function inferAvailability(snippet: string): {
  status: AvailabilityStatus;
  confidence: "HIGH" | "MEDIUM" | "LOW";
} {
  const s = snippet.toLowerCase();
  if (s.includes("in stock") && s.includes("store")) {
    return { status: "IN_STORE_LIKELY", confidence: "MEDIUM" };
  }
  if (s.includes("pickup today")) {
    return { status: "PICKUP_TODAY", confidence: "MEDIUM" };
  }
  if (s.includes("pickup") || s.includes("pick up")) {
    return { status: "PICKUP_ONLY", confidence: "LOW" };
  }
  if (s.includes("out of stock")) {
    return { status: "OUT_OF_STOCK", confidence: "MEDIUM" };
  }
  return { status: "UNKNOWN", confidence: "LOW" };
}

export class SerpApiConnector implements ProductSearchConnector {
  name = "SerpApiConnector";

  enabled(): boolean {
    return (
      process.env.ENABLE_SERPAPI_CONNECTOR === "true" &&
      !!process.env.SERPAPI_API_KEY
    );
  }

  async search(input: SearchInput): Promise<NormalizedInventoryResult[]> {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      console.log("[SerpApiConnector] No API key configured");
      return [];
    }

    const results: NormalizedInventoryResult[] = [];

    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("q", `${input.query} near ${input.zip}`);
      url.searchParams.set("location", `Marysville, Ohio`);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("engine", "google");

      const res = await fetch(url.toString());
      if (!res.ok) return [];

      const data = await res.json();

      // Process organic results
      const organic = data.organic_results || [];
      for (const item of organic.slice(0, 8)) {
        const snippet = item.snippet || "";
        const { status, confidence } = inferAvailability(snippet);

        results.push({
          title: item.title || input.query,
          brand: null,
          category: null,
          price: null,
          productUrl: item.link || null,
          imageUrl: item.thumbnail || null,
          storeName: item.source || "Unknown",
          retailer: item.source || "Unknown",
          address: "",
          city: "",
          state: "OH",
          zip: input.zip,
          latitude: input.latitude,
          longitude: input.longitude,
          phone: null,
          sourceName: this.name,
          sourceOfferId: null,
          availabilityStatus: status,
          confidence,
          evidenceText: snippet
            ? `Search snippet: "${snippet.substring(0, 200)}"`
            : "Search result, no availability details found.",
          lastCheckedAt: new Date(),
        });
      }

      // Process shopping results if available
      const shopping = data.shopping_results || [];
      for (const item of shopping.slice(0, 5)) {
        results.push({
          title: item.title || input.query,
          brand: null,
          category: null,
          price: item.extracted_price || null,
          productUrl: item.link || null,
          imageUrl: item.thumbnail || null,
          storeName: item.source || "Unknown",
          retailer: item.source || "Unknown",
          address: "",
          city: "",
          state: "OH",
          zip: input.zip,
          latitude: input.latitude,
          longitude: input.longitude,
          phone: null,
          sourceName: this.name,
          sourceOfferId: null,
          availabilityStatus: "ONLINE_ONLY",
          confidence: "LOW",
          evidenceText: `Shopping result from ${item.source || "unknown source"}. Likely online only.`,
          lastCheckedAt: new Date(),
        });
      }
    } catch (err) {
      console.error("[SerpApiConnector] Error:", err);
    }

    return results;
  }
}
