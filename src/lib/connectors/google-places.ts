import {
  ProductSearchConnector,
  SearchInput,
  NormalizedInventoryResult,
} from "../types";

export class GooglePlacesConnector implements ProductSearchConnector {
  name = "GooglePlacesConnector";

  enabled(): boolean {
    return (
      process.env.ENABLE_GOOGLE_PLACES_CONNECTOR === "true" &&
      !!process.env.GOOGLE_PLACES_API_KEY
    );
  }

  async search(input: SearchInput): Promise<NormalizedInventoryResult[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.log("[GooglePlacesConnector] No API key configured");
      return [];
    }

    const searchTerms = [
      `${input.query} store`,
      "sporting goods",
      "college apparel",
    ];

    const results: NormalizedInventoryResult[] = [];

    for (const term of searchTerms.slice(0, 2)) {
      try {
        const url = new URL(
          "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        );
        url.searchParams.set("location", `${input.latitude},${input.longitude}`);
        url.searchParams.set("radius", String(input.radiusMiles * 1609.34));
        url.searchParams.set("keyword", term);
        url.searchParams.set("key", apiKey);

        const res = await fetch(url.toString());
        if (!res.ok) continue;

        const data = await res.json();
        if (data.status !== "OK" || !data.results) continue;

        for (const place of data.results.slice(0, 5)) {
          results.push({
            title: input.query,
            brand: null,
            category: null,
            price: null,
            productUrl: null,
            imageUrl: null,
            storeName: place.name,
            retailer: place.name,
            address: place.vicinity || "",
            city: "",
            state: "OH",
            zip: "",
            latitude: place.geometry?.location?.lat || 0,
            longitude: place.geometry?.location?.lng || 0,
            phone: null,
            sourceName: this.name,
            sourceOfferId: place.place_id || null,
            availabilityStatus: "UNKNOWN",
            confidence: "LOW",
            evidenceText:
              "Nearby store matched category/query, but inventory not confirmed. Call store to check.",
            lastCheckedAt: new Date(),
          });
        }
      } catch (err) {
        console.error("[GooglePlacesConnector] Error:", err);
      }
    }

    return results;
  }
}
