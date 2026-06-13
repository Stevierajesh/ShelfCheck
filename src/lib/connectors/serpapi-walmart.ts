import {
  ProductSearchConnector,
  SearchInput,
  NormalizedInventoryResult,
  AvailabilityStatus,
  Confidence,
} from "../types";
import { distanceMiles } from "../geo";

// SerpApi Walmart Search API (engine=walmart)
// Docs: https://serpapi.com/walmart-search-api
//
// This connector searches Walmart's catalog via SerpApi and then
// fetches per-product detail (engine=walmart_product) to get
// store-level fulfillment/pickup data for the user's ZIP code.

const SERPAPI_BASE = "https://serpapi.com/search.json";

interface WalmartSearchItem {
  us_item_id?: string;
  product_id?: string;
  title?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  seller_name?: string;
  primary_offer?: {
    offer_price?: number;
    offer_id?: string;
  };
  fulfillment?: {
    pickup_today?: boolean;
    free_shipping?: boolean;
    ship_to_store?: boolean;
    delivery_today?: boolean;
    in_store?: boolean;
  };
  product_page_url?: string;
}

interface WalmartProductResult {
  product_result?: {
    us_item_id?: string;
    product_id?: string;
    title?: string;
    brand?: string;
    categories?: { name: string }[];
    thumbnail?: string;
    price_map?: {
      price?: number;
      was_price?: number;
    };
    offer_id?: string;
    product_page_url?: string;
  };
  fulfillment?: {
    pickup?: {
      available?: boolean;
      store_name?: string;
      store_address?: string;
      store_id?: string;
      availability_status?: string;
    }[];
    shipping?: {
      available?: boolean;
      arrival_date?: string;
    };
    delivery?: {
      available?: boolean;
      arrival_date?: string;
    };
  };
  // Some responses put pickup info at the top level
  pickup_options?: {
    available?: boolean;
    store_name?: string;
    store_address?: string;
    store_id?: string;
    availability_status?: string;
  }[];
}

function interpretFulfillment(
  searchFulfillment?: WalmartSearchItem["fulfillment"],
  detailFulfillment?: WalmartProductResult["fulfillment"],
  pickupOptions?: WalmartProductResult["pickup_options"]
): { status: AvailabilityStatus; confidence: Confidence; evidence: string } {
  // Detail-level fulfillment is most specific
  if (detailFulfillment) {
    const pickup = detailFulfillment.pickup;
    if (pickup && pickup.length > 0) {
      const first = pickup[0];
      if (first.available) {
        const statusText = (first.availability_status || "").toLowerCase();
        if (statusText.includes("in stock")) {
          return {
            status: "PICKUP_TODAY",
            confidence: "HIGH",
            evidence: `Walmart reports pickup available at ${first.store_name || "nearby store"}. Status: "${first.availability_status}".`,
          };
        }
        return {
          status: "PICKUP_ONLY",
          confidence: "MEDIUM",
          evidence: `Walmart reports pickup available at ${first.store_name || "nearby store"}.`,
        };
      }
    }

    if (detailFulfillment.shipping?.available) {
      return {
        status: "ONLINE_ONLY",
        confidence: "MEDIUM",
        evidence: `Walmart shipping available${detailFulfillment.shipping.arrival_date ? `, arrives ${detailFulfillment.shipping.arrival_date}` : ""}. No pickup found for this ZIP.`,
      };
    }

    if (detailFulfillment.delivery?.available) {
      return {
        status: "ONLINE_ONLY",
        confidence: "MEDIUM",
        evidence: `Walmart delivery available${detailFulfillment.delivery.arrival_date ? `, arrives ${detailFulfillment.delivery.arrival_date}` : ""}. No pickup found for this ZIP.`,
      };
    }
  }

  // Pickup options at top level
  if (pickupOptions && pickupOptions.length > 0) {
    const first = pickupOptions[0];
    if (first.available) {
      return {
        status: "PICKUP_TODAY",
        confidence: "HIGH",
        evidence: `Walmart reports pickup available at ${first.store_name || "nearby store"}.`,
      };
    }
  }

  // Fall back to search-level fulfillment flags
  if (searchFulfillment) {
    if (searchFulfillment.in_store) {
      return {
        status: "IN_STORE_LIKELY",
        confidence: "MEDIUM",
        evidence: "Walmart search result flagged as available in store.",
      };
    }
    if (searchFulfillment.pickup_today) {
      return {
        status: "PICKUP_TODAY",
        confidence: "MEDIUM",
        evidence: "Walmart search result flagged as pickup today.",
      };
    }
    if (searchFulfillment.ship_to_store) {
      return {
        status: "SHIP_TO_STORE",
        confidence: "MEDIUM",
        evidence: "Walmart search result flagged as ship-to-store.",
      };
    }
    if (searchFulfillment.delivery_today) {
      return {
        status: "PICKUP_TODAY",
        confidence: "LOW",
        evidence: "Walmart search result flagged for same-day delivery. Store stock likely.",
      };
    }
    if (searchFulfillment.free_shipping) {
      return {
        status: "ONLINE_ONLY",
        confidence: "LOW",
        evidence: "Walmart search result has shipping. No pickup/in-store signal found.",
      };
    }
  }

  return {
    status: "UNKNOWN",
    confidence: "LOW",
    evidence: "Walmart product found but fulfillment details unavailable for this ZIP.",
  };
}

export class SerpApiWalmartConnector implements ProductSearchConnector {
  name = "SerpApiWalmartConnector";

  enabled(): boolean {
    return (
      process.env.ENABLE_SERPAPI_WALMART_CONNECTOR === "true" &&
      !!process.env.SERPAPI_API_KEY
    );
  }

  async search(input: SearchInput): Promise<NormalizedInventoryResult[]> {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      console.log("[SerpApiWalmartConnector] No API key configured");
      return [];
    }

    const results: NormalizedInventoryResult[] = [];

    try {
      // Step 1: Search Walmart catalog
      const searchItems = await this.searchWalmart(apiKey, input.query);
      if (searchItems.length === 0) {
        console.log("[SerpApiWalmartConnector] No Walmart search results");
        return [];
      }

      // Step 2: For top results, fetch product detail with store/ZIP context
      const detailLimit = Math.min(searchItems.length, 5);
      const detailPromises = searchItems
        .slice(0, detailLimit)
        .map((item) =>
          this.getProductDetail(apiKey, item, input).catch((err) => {
            console.error(
              `[SerpApiWalmartConnector] Detail fetch failed for ${item.us_item_id}:`,
              err
            );
            return this.resultFromSearchItem(item, input);
          })
        );

      const detailResults = await Promise.allSettled(detailPromises);
      for (const r of detailResults) {
        if (r.status === "fulfilled" && r.value) {
          results.push(r.value);
        }
      }

      // Step 3: Add remaining search items without detail fetch
      for (const item of searchItems.slice(detailLimit)) {
        results.push(this.resultFromSearchItem(item, input));
      }
    } catch (err) {
      console.error("[SerpApiWalmartConnector] Error:", err);
    }

    // Filter results to within the requested radius
    return results.filter(
      (r) =>
        distanceMiles(input.latitude, input.longitude, r.latitude, r.longitude) <=
        input.radiusMiles
    );
  }

  private async searchWalmart(
    apiKey: string,
    query: string
  ): Promise<WalmartSearchItem[]> {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set("engine", "walmart");
    url.searchParams.set("query", query);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(
        `[SerpApiWalmartConnector] Search request failed: ${res.status}`
      );
      return [];
    }

    const data = await res.json();
    const organic: WalmartSearchItem[] = data.organic_results || [];
    return organic.slice(0, 10);
  }

  private async getProductDetail(
    apiKey: string,
    item: WalmartSearchItem,
    input: SearchInput
  ): Promise<NormalizedInventoryResult> {
    const productId = item.us_item_id || item.product_id;
    if (!productId) {
      return this.resultFromSearchItem(item, input);
    }

    const url = new URL(SERPAPI_BASE);
    url.searchParams.set("engine", "walmart_product");
    url.searchParams.set("product_id", productId);
    url.searchParams.set("api_key", apiKey);
    // Pass store_id if we know the nearest Walmart, or ZIP for location context
    const storeId = process.env.WALMART_STORE_ID;
    if (storeId) {
      url.searchParams.set("store_id", storeId);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      return this.resultFromSearchItem(item, input);
    }

    const data: WalmartProductResult = await res.json();
    const product = data.product_result;

    const { status, confidence, evidence } = interpretFulfillment(
      item.fulfillment,
      data.fulfillment,
      data.pickup_options
    );

    // Extract store info from pickup options if available
    const pickupStore =
      data.fulfillment?.pickup?.[0] ||
      data.pickup_options?.[0];

    const storeName = pickupStore?.store_name || "Walmart";
    const storeAddress = pickupStore?.store_address || "";

    // Parse address into components
    const { city, state, zip } = parseAddress(storeAddress, input);

    const price =
      product?.price_map?.price ??
      item.primary_offer?.offer_price ??
      null;

    const brand = product?.brand ?? null;
    const category =
      product?.categories && product.categories.length > 0
        ? product.categories[product.categories.length - 1].name
        : null;

    const productUrl =
      product?.product_page_url || item.product_page_url
        ? `https://www.walmart.com${product?.product_page_url || item.product_page_url}`
        : null;

    return {
      title: product?.title || item.title || "",
      brand,
      category,
      price,
      productUrl,
      imageUrl: product?.thumbnail || item.thumbnail || null,
      storeName,
      retailer: "Walmart",
      address: storeAddress,
      city,
      state,
      zip,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: null,
      sourceName: this.name,
      sourceOfferId: product?.offer_id || item.primary_offer?.offer_id || null,
      availabilityStatus: status,
      confidence,
      evidenceText: evidence,
      lastCheckedAt: new Date(),
    };
  }

  private resultFromSearchItem(
    item: WalmartSearchItem,
    input: SearchInput
  ): NormalizedInventoryResult {
    const { status, confidence, evidence } = interpretFulfillment(
      item.fulfillment
    );

    const productUrl = item.product_page_url
      ? `https://www.walmart.com${item.product_page_url}`
      : null;

    return {
      title: item.title || "",
      brand: null,
      category: null,
      price: item.primary_offer?.offer_price ?? null,
      productUrl,
      imageUrl: item.thumbnail || null,
      storeName: "Walmart",
      retailer: "Walmart",
      address: "",
      city: "",
      state: "OH",
      zip: input.zip,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: null,
      sourceName: this.name,
      sourceOfferId: item.primary_offer?.offer_id || null,
      availabilityStatus: status,
      confidence,
      evidenceText: evidence,
      lastCheckedAt: new Date(),
    };
  }
}

function parseAddress(
  address: string,
  input: SearchInput
): { city: string; state: string; zip: string } {
  if (!address) {
    return { city: "", state: "OH", zip: input.zip };
  }
  // Try to parse "123 Main St, Marysville, OH 43040" format
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 3) {
    const city = parts[parts.length - 2];
    const stateZip = parts[parts.length - 1];
    const match = stateZip.match(/([A-Z]{2})\s*(\d{5})?/);
    if (match) {
      return {
        city,
        state: match[1],
        zip: match[2] || input.zip,
      };
    }
  }
  return { city: "", state: "OH", zip: input.zip };
}
