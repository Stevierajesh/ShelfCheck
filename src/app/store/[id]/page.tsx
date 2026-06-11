"use client";

import { useEffect, useState, use } from "react";

interface StoreData {
  id: string;
  name: string;
  retailer: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  websiteUrl: string | null;
  hoursJson: string | null;
  updatedAt: string;
  inventoryOffers: {
    id: string;
    price: number | null;
    availabilityStatus: string;
    confidence: string;
    evidenceText: string;
    sourceName: string;
    lastCheckedAt: string;
    product: {
      id: string;
      title: string;
      brand: string | null;
      productUrl: string | null;
    };
  }[];
}

const AVAILABILITY_LABELS: Record<string, string> = {
  IN_STORE_LIKELY: "Likely in store",
  PICKUP_TODAY: "Pickup today",
  PICKUP_ONLY: "Pickup only",
  SHIP_TO_STORE: "Ship to store",
  ONLINE_ONLY: "Online only",
  OUT_OF_STOCK: "Out of stock",
  UNKNOWN: "Unknown",
};

export default function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stores/${id}`)
      .then((r) => r.json())
      .then((data) => setStore(data.store || null))
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4 text-sm">Loading...</div>;
  if (!store) return <div className="p-4 text-sm">Store not found.</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <a href="/" className="text-sm text-blue-600 underline">
        Back to search
      </a>

      <h1 className="text-xl font-bold mt-3">{store.name}</h1>
      <p className="text-sm text-gray-500">{store.retailer}</p>

      <div className="mt-3 text-sm space-y-1">
        <p>
          {store.address}, {store.city}, {store.state} {store.zip}
        </p>
        {store.phone && (
          <p>
            Phone:{" "}
            <a href={`tel:${store.phone}`} className="text-blue-600">
              {store.phone}
            </a>
          </p>
        )}
        {store.websiteUrl && (
          <p>
            <a
              href={store.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Website
            </a>
          </p>
        )}
        <p className="text-xs text-gray-400">
          Last updated: {new Date(store.updatedAt).toLocaleString()}
        </p>
      </div>

      <h2 className="text-lg font-medium mt-6 mb-2">Products found here</h2>

      {store.inventoryOffers.length === 0 ? (
        <p className="text-sm text-gray-500">No products recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {store.inventoryOffers.map((offer) => (
            <div key={offer.id} className="border rounded p-3 text-sm">
              <div className="font-medium">{offer.product.title}</div>
              {offer.product.brand && (
                <div className="text-xs text-gray-500">
                  {offer.product.brand}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <span>
                  {AVAILABILITY_LABELS[offer.availabilityStatus] ||
                    offer.availabilityStatus}
                </span>
                {offer.price != null && <span>${offer.price.toFixed(2)}</span>}
                <span className="text-gray-400">
                  Confidence: {offer.confidence}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Source: {offer.sourceName}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {offer.evidenceText}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
