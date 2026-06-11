import {
  ProductSearchConnector,
  SearchInput,
  NormalizedInventoryResult,
  AvailabilityStatus,
  Confidence,
} from "../types";
import { distanceMiles } from "../geo";

interface SeedStore {
  name: string;
  retailer: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
}

interface SeedProduct {
  title: string;
  brand: string;
  category: string;
  price: number;
  availability: AvailabilityStatus;
  confidence: Confidence;
  evidence: string;
  storeIndices: number[];
}

const SEED_STORES: SeedStore[] = [
  {
    name: "Walmart Supercenter",
    retailer: "Walmart",
    address: "555 Coleman's Crossing Blvd",
    city: "Marysville",
    state: "OH",
    zip: "43040",
    lat: 40.2318,
    lng: -83.3575,
    phone: "(937) 644-0150",
  },
  {
    name: "Meijer",
    retailer: "Meijer",
    address: "17000 Square Dr",
    city: "Marysville",
    state: "OH",
    zip: "43040",
    lat: 40.2273,
    lng: -83.3481,
    phone: "(937) 578-6060",
  },
  {
    name: "Kroger Marketplace",
    retailer: "Kroger",
    address: "741 E 5th St",
    city: "Marysville",
    state: "OH",
    zip: "43040",
    lat: 40.2345,
    lng: -83.3555,
    phone: "(937) 642-4545",
  },
  {
    name: "Target",
    retailer: "Target",
    address: "4075 W Dublin Granville Rd",
    city: "Dublin",
    state: "OH",
    zip: "43017",
    lat: 40.1042,
    lng: -83.1627,
    phone: "(614) 717-9560",
  },
  {
    name: "Rally House Columbus",
    retailer: "Rally House",
    address: "1576 Polaris Pkwy",
    city: "Columbus",
    state: "OH",
    zip: "43240",
    lat: 40.1467,
    lng: -82.9812,
    phone: "(614) 468-4870",
  },
  {
    name: "Barnes & Noble - OSU",
    retailer: "Barnes & Noble",
    address: "1598 N High St",
    city: "Columbus",
    state: "OH",
    zip: "43201",
    lat: 39.9961,
    lng: -83.0069,
    phone: "(614) 247-2000",
  },
];

const SEED_PRODUCTS: SeedProduct[] = [
  {
    title: "Ohio State Buckeyes 3x5 House Flag",
    brand: "WinCraft",
    category: "Flags & Banners",
    price: 24.99,
    availability: "PICKUP_TODAY",
    confidence: "MEDIUM",
    evidence:
      "Seeded test record. Simulates pickup-today availability. Replace with verified connector data before production.",
    storeIndices: [0, 3],
  },
  {
    title: "Ohio State Buckeyes Garden Flag 12x18",
    brand: "WinCraft",
    category: "Flags & Banners",
    price: 12.99,
    availability: "IN_STORE_LIKELY",
    confidence: "LOW",
    evidence:
      "Seeded test record. This item is commonly stocked at this retailer. Call to confirm.",
    storeIndices: [0, 1, 3],
  },
  {
    title: "Ohio State Buckeyes Banner Flag",
    brand: "BSI Products",
    category: "Flags & Banners",
    price: 18.99,
    availability: "IN_STORE_LIKELY",
    confidence: "MEDIUM",
    evidence:
      "Seeded test record. Simulates likely in-store availability at a college merchandise retailer.",
    storeIndices: [4, 5],
  },
  {
    title: "Ohio State Car Flag",
    brand: "Fremont Die",
    category: "Flags & Banners",
    price: 14.99,
    availability: "PICKUP_TODAY",
    confidence: "MEDIUM",
    evidence:
      "Seeded test record. Simulates pickup-today availability.",
    storeIndices: [0, 4],
  },
  {
    title: "Ohio State Buckeyes House Flag - Brutus",
    brand: "Evergreen",
    category: "Flags & Banners",
    price: 29.99,
    availability: "UNKNOWN",
    confidence: "LOW",
    evidence:
      "Seeded test record. Store carries college merchandise but specific item inventory not confirmed.",
    storeIndices: [1, 2],
  },
  {
    title: "Ohio State Buckeyes Double Sided Garden Flag",
    brand: "Team Sports America",
    category: "Flags & Banners",
    price: 15.99,
    availability: "ONLINE_ONLY",
    confidence: "MEDIUM",
    evidence:
      "Seeded test record. This item is typically available online only from this retailer.",
    storeIndices: [3],
  },
  {
    title: "Ohio State Buckeyes Yard Flag with Pole",
    brand: "WinCraft",
    category: "Flags & Banners",
    price: 34.99,
    availability: "OUT_OF_STOCK",
    confidence: "LOW",
    evidence:
      "Seeded test record. Simulates out-of-stock status.",
    storeIndices: [0],
  },
];

function matchesQuery(query: string, product: SeedProduct): boolean {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/);
  const text =
    `${product.title} ${product.brand} ${product.category}`.toLowerCase();
  // Require at least half the terms to match
  const matches = terms.filter((t) => text.includes(t)).length;
  return matches >= Math.ceil(terms.length * 0.4);
}

export class SeedDataConnector implements ProductSearchConnector {
  name = "SeedDataConnector";

  enabled(): boolean {
    return process.env.ENABLE_SEED_CONNECTOR !== "false";
  }

  async search(input: SearchInput): Promise<NormalizedInventoryResult[]> {
    const results: NormalizedInventoryResult[] = [];
    const matchingProducts = SEED_PRODUCTS.filter((p) =>
      matchesQuery(input.query, p)
    );

    for (const product of matchingProducts) {
      for (const storeIdx of product.storeIndices) {
        const store = SEED_STORES[storeIdx];
        const dist = distanceMiles(
          input.latitude,
          input.longitude,
          store.lat,
          store.lng
        );
        if (dist <= input.radiusMiles) {
          results.push({
            title: product.title,
            brand: product.brand,
            category: product.category,
            price: product.price,
            productUrl: null,
            imageUrl: null,
            storeName: store.name,
            retailer: store.retailer,
            address: store.address,
            city: store.city,
            state: store.state,
            zip: store.zip,
            latitude: store.lat,
            longitude: store.lng,
            phone: store.phone,
            sourceName: this.name,
            sourceOfferId: null,
            availabilityStatus: product.availability,
            confidence: product.confidence,
            evidenceText: product.evidence,
            lastCheckedAt: new Date(),
          });
        }
      }
    }

    return results;
  }
}

export const SEED_STORES_DATA = SEED_STORES;
export const SEED_PRODUCTS_DATA = SEED_PRODUCTS;
