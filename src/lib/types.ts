export type AvailabilityStatus =
  | "IN_STORE_LIKELY"
  | "PICKUP_TODAY"
  | "PICKUP_ONLY"
  | "SHIP_TO_STORE"
  | "ONLINE_ONLY"
  | "OUT_OF_STOCK"
  | "UNKNOWN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface NormalizedInventoryResult {
  title: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  storeName: string;
  retailer: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  sourceName: string;
  sourceOfferId: string | null;
  availabilityStatus: AvailabilityStatus;
  confidence: Confidence;
  evidenceText: string;
  lastCheckedAt: Date;
}

export interface SearchInput {
  query: string;
  zip: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
}

export interface ProductSearchConnector {
  name: string;
  enabled(): boolean;
  search(input: SearchInput): Promise<NormalizedInventoryResult[]>;
}

export interface SearchResult {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  storeName: string;
  retailer: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  distance: number;
  availabilityStatus: AvailabilityStatus;
  confidence: Confidence;
  evidenceText: string;
  lastCheckedAt: string;
  sourceName: string;
  storeId: string;
  productId: string;
  offerId: string;
}
