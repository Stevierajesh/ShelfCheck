import { prisma } from "./db";
import { geocodeZip, distanceMiles } from "./geo";
import { getEnabledConnectors } from "./connectors";
import {
  NormalizedInventoryResult,
  SearchResult,
  AvailabilityStatus,
} from "./types";

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

// Simple cache: key -> { results, timestamp }
const searchCache = new Map<
  string,
  { results: NormalizedInventoryResult[]; ts: number }
>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(query: string, zip: string, radius: number): string {
  return `${query.toLowerCase().trim()}|${zip}|${radius}`;
}

function normalizeForDedup(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deduplicateResults(
  results: NormalizedInventoryResult[]
): NormalizedInventoryResult[] {
  const seen = new Map<string, NormalizedInventoryResult>();

  for (const r of results) {
    const key = `${normalizeForDedup(r.title)}|${normalizeForDedup(r.storeName)}|${normalizeForDedup(r.address)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
    } else {
      // Keep the one with better availability
      const existingPri =
        AVAILABILITY_PRIORITY[existing.availabilityStatus] ?? 99;
      const newPri = AVAILABILITY_PRIORITY[r.availabilityStatus] ?? 99;
      if (
        newPri < existingPri ||
        (newPri === existingPri &&
          CONFIDENCE_PRIORITY[r.confidence] <
            CONFIDENCE_PRIORITY[existing.confidence])
      ) {
        seen.set(key, r);
      }
    }
  }

  return Array.from(seen.values());
}

export interface SearchOptions {
  query: string;
  zip: string;
  radiusMiles: number;
  hideOnlineOnly?: boolean;
  inStoreOnly?: boolean;
}

export async function executeSearch(
  options: SearchOptions
): Promise<SearchResult[]> {
  const { query, zip, radiusMiles, hideOnlineOnly, inStoreOnly } = options;

  const coords = geocodeZip(zip);
  if (!coords) {
    // Fallback to 43040 coords if ZIP unknown
    const fallback = geocodeZip("43040")!;
    return executeSearchWithCoords(
      query,
      zip,
      radiusMiles,
      fallback.lat,
      fallback.lng,
      hideOnlineOnly,
      inStoreOnly
    );
  }

  return executeSearchWithCoords(
    query,
    zip,
    radiusMiles,
    coords.lat,
    coords.lng,
    hideOnlineOnly,
    inStoreOnly
  );
}

async function executeSearchWithCoords(
  query: string,
  zip: string,
  radiusMiles: number,
  lat: number,
  lng: number,
  hideOnlineOnly?: boolean,
  inStoreOnly?: boolean
): Promise<SearchResult[]> {
  const ck = cacheKey(query, zip, radiusMiles);
  let allResults: NormalizedInventoryResult[];

  const cached = searchCache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    allResults = cached.results;
  } else {
    const connectors = getEnabledConnectors();
    const connectorResults = await Promise.allSettled(
      connectors.map((c) =>
        c.search({ query, zip, latitude: lat, longitude: lng, radiusMiles })
      )
    );

    allResults = [];
    for (const result of connectorResults) {
      if (result.status === "fulfilled") {
        allResults.push(...result.value);
      } else {
        console.error("[Search] Connector failed:", result.reason);
      }
    }

    searchCache.set(ck, { results: allResults, ts: Date.now() });
  }

  // Deduplicate
  const deduped = deduplicateResults(allResults);

  // Persist to database
  const searchResults = await persistAndEnrich(deduped, lat, lng);

  // Filter
  let filtered = searchResults;
  if (hideOnlineOnly) {
    filtered = filtered.filter(
      (r) =>
        r.availabilityStatus !== "ONLINE_ONLY" &&
        r.availabilityStatus !== "OUT_OF_STOCK"
    );
  }
  if (inStoreOnly) {
    filtered = filtered.filter(
      (r) =>
        r.availabilityStatus === "IN_STORE_LIKELY" ||
        r.availabilityStatus === "PICKUP_TODAY"
    );
  }

  // Filter by radius
  filtered = filtered.filter((r) => r.distance <= radiusMiles);

  // Sort
  filtered.sort((a, b) => {
    const aPri = AVAILABILITY_PRIORITY[a.availabilityStatus] ?? 99;
    const bPri = AVAILABILITY_PRIORITY[b.availabilityStatus] ?? 99;
    if (aPri !== bPri) return aPri - bPri;
    if (a.distance !== b.distance) return a.distance - b.distance;
    const aCon = CONFIDENCE_PRIORITY[a.confidence] ?? 99;
    const bCon = CONFIDENCE_PRIORITY[b.confidence] ?? 99;
    if (aCon !== bCon) return aCon - bCon;
    return (
      new Date(b.lastCheckedAt).getTime() -
      new Date(a.lastCheckedAt).getTime()
    );
  });

  // Log search
  await prisma.searchLog
    .create({
      data: {
        query,
        zip,
        radiusMiles,
        resultCount: filtered.length,
      },
    })
    .catch(() => {});

  return filtered;
}

async function persistAndEnrich(
  results: NormalizedInventoryResult[],
  userLat: number,
  userLng: number
): Promise<SearchResult[]> {
  const searchResults: SearchResult[] = [];

  for (const r of results) {
    try {
      // Upsert store
      const storeKey = normalizeForDedup(
        `${r.retailer}${r.storeName}${r.address}`
      );
      let store = await prisma.store.findFirst({
        where: {
          retailer: r.retailer,
          name: r.storeName,
        },
      });

      if (!store) {
        store = await prisma.store.create({
          data: {
            name: r.storeName,
            retailer: r.retailer,
            address: r.address,
            city: r.city,
            state: r.state,
            zip: r.zip,
            latitude: r.latitude,
            longitude: r.longitude,
            phone: r.phone,
          },
        });
      }

      // Upsert product
      let product = await prisma.product.findFirst({
        where: {
          title: r.title,
          sourceName: r.sourceName,
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            title: r.title,
            brand: r.brand,
            category: r.category,
            sourceName: r.sourceName,
            productUrl: r.productUrl,
            imageUrl: r.imageUrl,
          },
        });
      }

      // Upsert offer
      let offer = await prisma.inventoryOffer.findFirst({
        where: {
          productId: product.id,
          storeId: store.id,
          sourceName: r.sourceName,
        },
      });

      if (offer) {
        offer = await prisma.inventoryOffer.update({
          where: { id: offer.id },
          data: {
            price: r.price,
            availabilityStatus: r.availabilityStatus,
            confidence: r.confidence,
            evidenceText: r.evidenceText,
            productUrl: r.productUrl,
            lastCheckedAt: r.lastCheckedAt,
          },
        });
      } else {
        offer = await prisma.inventoryOffer.create({
          data: {
            productId: product.id,
            storeId: store.id,
            sourceName: r.sourceName,
            sourceOfferId: r.sourceOfferId,
            price: r.price,
            availabilityStatus: r.availabilityStatus,
            confidence: r.confidence,
            evidenceText: r.evidenceText,
            productUrl: r.productUrl,
            lastCheckedAt: r.lastCheckedAt,
          },
        });
      }

      const dist = distanceMiles(
        userLat,
        userLng,
        r.latitude,
        r.longitude
      );

      searchResults.push({
        id: offer.id,
        title: r.title,
        brand: r.brand,
        category: r.category,
        price: r.price,
        productUrl: r.productUrl,
        imageUrl: r.imageUrl,
        storeName: r.storeName,
        retailer: r.retailer,
        address: r.address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        phone: r.phone,
        distance: Math.round(dist * 10) / 10,
        availabilityStatus: r.availabilityStatus as AvailabilityStatus,
        confidence: r.confidence,
        evidenceText: r.evidenceText,
        lastCheckedAt: r.lastCheckedAt.toISOString(),
        sourceName: r.sourceName,
        storeId: store.id,
        productId: product.id,
        offerId: offer.id,
      });
    } catch (err) {
      console.error("[Search] Error persisting result:", err);
      // Still include in results even if DB persistence fails
      searchResults.push({
        id: "temp-" + Math.random().toString(36).slice(2),
        title: r.title,
        brand: r.brand,
        category: r.category,
        price: r.price,
        productUrl: r.productUrl,
        imageUrl: r.imageUrl,
        storeName: r.storeName,
        retailer: r.retailer,
        address: r.address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        phone: r.phone,
        distance: Math.round(
          distanceMiles(userLat, userLng, r.latitude, r.longitude) * 10
        ) / 10,
        availabilityStatus: r.availabilityStatus as AvailabilityStatus,
        confidence: r.confidence,
        evidenceText: r.evidenceText,
        lastCheckedAt: r.lastCheckedAt.toISOString(),
        sourceName: r.sourceName,
        storeId: "",
        productId: "",
        offerId: "",
      });
    }
  }

  return searchResults;
}
