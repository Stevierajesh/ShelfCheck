import {
  ProductSearchConnector,
  SearchInput,
  NormalizedInventoryResult,
  AvailabilityStatus,
  Confidence,
} from "../types";

// SerpApi Google Shopping API (engine=google_shopping)
// Docs: https://serpapi.com/google-shopping-api
//
// Searches Google Shopping which aggregates product listings across
// Walmart, Target, Meijer, Amazon, Dick's, Rally House, and hundreds
// of other retailers in a single query. Returns structured product data
// including price, retailer, and sometimes local store availability.

const SERPAPI_BASE = "https://serpapi.com/search.json";

interface ShoppingResult {
  position?: number;
  product_id?: string;
  title?: string;
  link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  delivery?: string;
  store_rating?: number;
  store_reviews?: number;
  badge?: string;
  tag?: string;
}

interface LocalShoppingResult {
  position?: number;
  title?: string;
  link?: string;
  source?: string;
  store_name?: string;
  store_link?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  delivery?: string;
  in_stock?: boolean;
  pickup?: string;
  pickup_today?: boolean;
  nearby_store?: {
    name?: string;
    address?: string;
    distance?: string;
    phone?: string;
  };
}

function inferAvailabilityFromShopping(
  item: ShoppingResult | LocalShoppingResult
): { status: AvailabilityStatus; confidence: Confidence; evidence: string } {
  const delivery = (item.delivery || "").toLowerCase();
  const badge = ("badge" in item ? item.badge || "" : "").toLowerCase();
  const tag = ("tag" in item ? item.tag || "" : "").toLowerCase();
  const source = (item.source || "").toLowerCase();

  // Local results with explicit stock/pickup info
  if ("in_stock" in item && item.in_stock === true) {
    return {
      status: "IN_STORE_LIKELY",
      confidence: "MEDIUM",
      evidence: `Google Shopping reports in stock at ${item.source || "store"}.`,
    };
  }

  if ("pickup_today" in item && item.pickup_today === true) {
    return {
      status: "PICKUP_TODAY",
      confidence: "MEDIUM",
      evidence: `Google Shopping reports pickup today at ${item.source || "store"}.`,
    };
  }

  if ("pickup" in item && item.pickup) {
    const pickupText = (item.pickup as string).toLowerCase();
    if (pickupText.includes("today")) {
      return {
        status: "PICKUP_TODAY",
        confidence: "MEDIUM",
        evidence: `Google Shopping: "${item.pickup}" at ${item.source || "store"}.`,
      };
    }
    return {
      status: "PICKUP_ONLY",
      confidence: "LOW",
      evidence: `Google Shopping: "${item.pickup}" at ${item.source || "store"}.`,
    };
  }

  // Check delivery/badge text for signals
  const allText = `${delivery} ${badge} ${tag}`;

  if (allText.includes("in stock") && allText.includes("store")) {
    return {
      status: "IN_STORE_LIKELY",
      confidence: "MEDIUM",
      evidence: `Google Shopping indicates in-store availability at ${item.source || "store"}.`,
    };
  }

  if (allText.includes("pickup today") || allText.includes("pick up today")) {
    return {
      status: "PICKUP_TODAY",
      confidence: "MEDIUM",
      evidence: `Google Shopping indicates pickup today from ${item.source || "store"}.`,
    };
  }

  if (allText.includes("pickup") || allText.includes("pick up")) {
    return {
      status: "PICKUP_ONLY",
      confidence: "LOW",
      evidence: `Google Shopping indicates pickup available from ${item.source || "store"}.`,
    };
  }

  if (allText.includes("nearby") || allText.includes("local")) {
    return {
      status: "UNKNOWN",
      confidence: "LOW",
      evidence: `Google Shopping lists ${item.source || "store"} as nearby. Inventory not confirmed.`,
    };
  }

  if (
    allText.includes("free delivery") ||
    allText.includes("free shipping") ||
    allText.includes("delivery")
  ) {
    return {
      status: "ONLINE_ONLY",
      confidence: "LOW",
      evidence: `Google Shopping shows shipping/delivery from ${item.source || "store"}. No in-store signal found.`,
    };
  }

  if (allText.includes("out of stock") || allText.includes("unavailable")) {
    return {
      status: "OUT_OF_STOCK",
      confidence: "MEDIUM",
      evidence: `Google Shopping reports out of stock at ${item.source || "store"}.`,
    };
  }

  return {
    status: "ONLINE_ONLY",
    confidence: "LOW",
    evidence: `Google Shopping listing from ${item.source || "unknown retailer"}. No in-store availability signal.`,
  };
}

function extractRetailer(source: string): string {
  if (!source) return "Unknown";
  const map: Record<string, string> = {
    "walmart": "Walmart",
    "walmart.com": "Walmart",
    "target": "Target",
    "target.com": "Target",
    "meijer": "Meijer",
    "meijer.com": "Meijer",
    "kroger": "Kroger",
    "kroger.com": "Kroger",
    "amazon": "Amazon",
    "amazon.com": "Amazon",
    "ebay": "eBay",
    "ebay.com": "eBay",
    "dick's sporting goods": "Dick's Sporting Goods",
    "dickssportinggoods.com": "Dick's Sporting Goods",
    "rally house": "Rally House",
    "rallyhouse.com": "Rally House",
    "kohl's": "Kohl's",
    "kohls.com": "Kohl's",
    "bed bath & beyond": "Bed Bath & Beyond",
    "fanatics": "Fanatics",
    "fanatics.com": "Fanatics",
  };
  const lower = source.toLowerCase().trim();
  if (map[lower]) return map[lower];
  // Partial match: "Rally House Columbus" → "Rally House"
  for (const [key, value] of Object.entries(map)) {
    if (lower.startsWith(key)) return value;
  }
  return source;
}

export class SerpApiShoppingConnector implements ProductSearchConnector {
  name = "SerpApiShoppingConnector";

  enabled(): boolean {
    return (
      process.env.ENABLE_SERPAPI_SHOPPING_CONNECTOR === "true" &&
      !!process.env.SERPAPI_API_KEY
    );
  }

  async search(input: SearchInput): Promise<NormalizedInventoryResult[]> {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      console.log("[SerpApiShoppingConnector] No API key configured");
      return [];
    }

    const results: NormalizedInventoryResult[] = [];

    try {
      // Run two queries: one general, one location-scoped
      const [generalResults, localResults] = await Promise.allSettled([
        this.searchShopping(apiKey, input.query, input),
        this.searchShopping(apiKey, `${input.query} near ${input.zip}`, input),
      ]);

      if (generalResults.status === "fulfilled") {
        results.push(...generalResults.value);
      }
      if (localResults.status === "fulfilled") {
        results.push(...localResults.value);
      }

      // Deduplicate by title+source within this connector
      const seen = new Set<string>();
      const deduped: NormalizedInventoryResult[] = [];
      for (const r of results) {
        const key = `${r.title.toLowerCase().trim()}|${r.retailer.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(r);
        }
      }
      return deduped;
    } catch (err) {
      console.error("[SerpApiShoppingConnector] Error:", err);
      return [];
    }
  }

  private async searchShopping(
    apiKey: string,
    query: string,
    input: SearchInput
  ): Promise<NormalizedInventoryResult[]> {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("location", `${input.zip}, Ohio, United States`);
    url.searchParams.set("gl", "us");
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(
        `[SerpApiShoppingConnector] Request failed: ${res.status}`
      );
      return [];
    }

    const data = await res.json();
    const results: NormalizedInventoryResult[] = [];

    // Process main shopping results
    const shoppingResults: ShoppingResult[] = data.shopping_results || [];
    for (const item of shoppingResults.slice(0, 12)) {
      results.push(this.normalizeResult(item, input));
    }

    // Process local shopping results (these have store-level info)
    const localResults: LocalShoppingResult[] =
      data.local_shopping_results || data.local_results || [];
    for (const item of localResults.slice(0, 8)) {
      results.push(this.normalizeLocalResult(item, input));
    }

    return results;
  }

  private normalizeResult(
    item: ShoppingResult,
    input: SearchInput
  ): NormalizedInventoryResult {
    const { status, confidence, evidence } =
      inferAvailabilityFromShopping(item);
    const retailer = extractRetailer(item.source || "");

    return {
      title: item.title || "",
      brand: null,
      category: null,
      price: item.extracted_price ?? null,
      productUrl: item.link || null,
      imageUrl: item.thumbnail || null,
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
      sourceOfferId: item.product_id || null,
      availabilityStatus: status,
      confidence,
      evidenceText: evidence,
      lastCheckedAt: new Date(),
    };
  }

  private normalizeLocalResult(
    item: LocalShoppingResult,
    input: SearchInput
  ): NormalizedInventoryResult {
    const { status, confidence, evidence } =
      inferAvailabilityFromShopping(item);
    const retailer = extractRetailer(
      item.store_name || item.source || ""
    );

    const nearbyStore = item.nearby_store;
    const storeName = nearbyStore?.name || item.store_name || retailer;
    const address = nearbyStore?.address || "";
    const phone = nearbyStore?.phone || null;

    return {
      title: item.title || "",
      brand: null,
      category: null,
      price: item.extracted_price ?? null,
      productUrl: item.link || null,
      imageUrl: item.thumbnail || null,
      storeName,
      retailer,
      address,
      city: "",
      state: "OH",
      zip: input.zip,
      latitude: input.latitude,
      longitude: input.longitude,
      phone,
      sourceName: this.name,
      sourceOfferId: null,
      availabilityStatus: status,
      confidence,
      evidenceText: evidence,
      lastCheckedAt: new Date(),
    };
  }
}
