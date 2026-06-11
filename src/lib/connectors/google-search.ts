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
  if (s.includes("in stock") && (s.includes("store") || s.includes("pickup"))) {
    return { status: "IN_STORE_LIKELY", confidence: "MEDIUM" };
  }
  if (s.includes("pickup today")) {
    return { status: "PICKUP_TODAY", confidence: "MEDIUM" };
  }
  if (s.includes("pickup") || s.includes("pick up")) {
    return { status: "PICKUP_ONLY", confidence: "LOW" };
  }
  if (s.includes("ship to store")) {
    return { status: "SHIP_TO_STORE", confidence: "LOW" };
  }
  if (s.includes("out of stock") || s.includes("unavailable")) {
    return { status: "OUT_OF_STOCK", confidence: "MEDIUM" };
  }
  if (s.includes("shipping") || s.includes("online")) {
    return { status: "ONLINE_ONLY", confidence: "LOW" };
  }
  return { status: "UNKNOWN", confidence: "LOW" };
}

function extractRetailer(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const map: Record<string, string> = {
      "walmart.com": "Walmart",
      "target.com": "Target",
      "meijer.com": "Meijer",
      "kroger.com": "Kroger",
      "amazon.com": "Amazon",
      "ebay.com": "eBay",
      "dickssportinggoods.com": "Dick's Sporting Goods",
      "rallyhouse.com": "Rally House",
    };
    return map[host] || host;
  } catch {
    return "Unknown";
  }
}

export class GoogleCustomSearchConnector implements ProductSearchConnector {
  name = "GoogleCustomSearchConnector";

  enabled(): boolean {
    return (
      process.env.ENABLE_GOOGLE_SEARCH_CONNECTOR === "true" &&
      !!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY &&
      !!process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
    );
  }

  async search(input: SearchInput): Promise<NormalizedInventoryResult[]> {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
    if (!apiKey || !cx) {
      console.log("[GoogleCustomSearchConnector] Missing API key or CX");
      return [];
    }

    const queries = [
      `${input.query} pickup near ${input.zip}`,
      `${input.query} in stock ${input.zip}`,
    ];

    const results: NormalizedInventoryResult[] = [];

    for (const q of queries) {
      try {
        const url = new URL("https://www.googleapis.com/customsearch/v1");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("cx", cx);
        url.searchParams.set("q", q);
        url.searchParams.set("num", "5");

        const res = await fetch(url.toString());
        if (!res.ok) continue;

        const data = await res.json();
        if (!data.items) continue;

        for (const item of data.items) {
          const snippet = item.snippet || "";
          const { status, confidence } = inferAvailability(snippet);
          const retailer = extractRetailer(item.link || "");

          results.push({
            title: item.title || input.query,
            brand: null,
            category: null,
            price: null,
            productUrl: item.link || null,
            imageUrl: null,
            storeName: retailer,
            retailer,
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
              : "Web search result, no availability details found.",
            lastCheckedAt: new Date(),
          });
        }
      } catch (err) {
        console.error("[GoogleCustomSearchConnector] Error:", err);
      }
    }

    return results;
  }
}
