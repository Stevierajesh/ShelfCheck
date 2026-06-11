"use client";

import { useState, FormEvent } from "react";
import { SearchResult } from "@/lib/types";

const AVAILABILITY_LABELS: Record<string, string> = {
  IN_STORE_LIKELY: "Likely in store",
  PICKUP_TODAY: "Pickup today",
  PICKUP_ONLY: "Pickup only",
  SHIP_TO_STORE: "Ship to store",
  ONLINE_ONLY: "Online only",
  OUT_OF_STOCK: "Out of stock",
  UNKNOWN: "Unknown",
};

const AVAILABILITY_COLORS: Record<string, string> = {
  IN_STORE_LIKELY: "bg-green-100 text-green-800",
  PICKUP_TODAY: "bg-green-100 text-green-800",
  PICKUP_ONLY: "bg-yellow-100 text-yellow-800",
  SHIP_TO_STORE: "bg-yellow-100 text-yellow-800",
  ONLINE_ONLY: "bg-gray-100 text-gray-700",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
  UNKNOWN: "bg-gray-100 text-gray-600",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "text-green-700",
  MEDIUM: "text-yellow-700",
  LOW: "text-gray-500",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function directionsUrl(address: string, city: string, state: string): string {
  const q = encodeURIComponent(`${address}, ${city}, ${state}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [zip, setZip] = useState("43040");
  const [radius, setRadius] = useState(25);
  const [hideOnlineOnly, setHideOnlineOnly] = useState(false);
  const [inStoreOnly, setInStoreOnly] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        zip,
        radius: String(radius),
        hideOnlineOnly: String(hideOnlineOnly),
        inStoreOnly: String(inStoreOnly),
      });

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setError("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <form onSubmit={handleSearch} className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a product..."
          className="w-full border rounded px-3 py-2.5 text-base"
          autoFocus
        />

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">ZIP Code</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              maxLength={5}
              pattern="[0-9]{5}"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Radius</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value={5}>5 miles</option>
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hideOnlineOnly}
              onChange={(e) => setHideOnlineOnly(e.target.checked)}
            />
            Hide online-only
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={inStoreOnly}
              onChange={(e) => setInStoreOnly(e.target.checked)}
            />
            In-store / pickup only
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full bg-black text-white rounded py-2.5 text-base font-medium disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-red-600 text-sm">{error}</p>
      )}

      {searched && !loading && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-2">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>

          {results.length > 0 && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
              Inventory can be wrong. Call before driving, especially for
              low-stock items.
            </p>
          )}

          <div className="space-y-3">
            {results.map((r) => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>

          {results.length === 0 && (
            <p className="text-sm text-gray-500">
              No results found. Try broadening your search or increasing the
              radius.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ result: r }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded p-3 text-sm">
      <div className="font-medium text-base mb-1">{r.title}</div>

      <div className="text-gray-700">
        {r.storeName}
        {r.retailer !== r.storeName && ` (${r.retailer})`}
      </div>
      <div className="text-gray-500 text-xs">
        {r.address && `${r.address}, `}
        {r.city && `${r.city}, `}
        {r.state} {r.zip}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${AVAILABILITY_COLORS[r.availabilityStatus] || "bg-gray-100"}`}
        >
          {AVAILABILITY_LABELS[r.availabilityStatus] || r.availabilityStatus}
        </span>
        <span className="text-xs text-gray-400">
          {r.distance} mi
        </span>
        {r.price != null && (
          <span className="text-xs font-medium">${r.price.toFixed(2)}</span>
        )}
      </div>

      <div className="mt-1 text-xs">
        <span className={CONFIDENCE_COLORS[r.confidence] || ""}>
          Confidence: {r.confidence}
        </span>
        <span className="text-gray-400 ml-2">
          {formatDate(r.lastCheckedAt)}
        </span>
      </div>

      {r.availabilityStatus === "UNKNOWN" && (
        <p className="mt-1 text-xs text-orange-600">
          This store may carry similar items, but inventory has not been
          verified.
        </p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-blue-600 underline"
      >
        {expanded ? "Less" : "More details"}
      </button>

      {expanded && (
        <div className="mt-2 text-xs space-y-1 border-t pt-2">
          <div>
            <span className="text-gray-500">Source:</span> {r.sourceName}
          </div>
          <div>
            <span className="text-gray-500">Evidence:</span> {r.evidenceText}
          </div>
          {r.brand && (
            <div>
              <span className="text-gray-500">Brand:</span> {r.brand}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            {r.productUrl && (
              <a
                href={r.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gray-100 rounded px-3 py-1.5"
              >
                Open product
              </a>
            )}
            {r.address && (
              <a
                href={directionsUrl(r.address, r.city, r.state)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gray-100 rounded px-3 py-1.5"
              >
                Directions
              </a>
            )}
            {r.phone && (
              <a
                href={`tel:${r.phone}`}
                className="inline-block bg-gray-100 rounded px-3 py-1.5"
              >
                Call store
              </a>
            )}
            {r.storeId && (
              <a
                href={`/store/${r.storeId}`}
                className="inline-block bg-gray-100 rounded px-3 py-1.5"
              >
                Store details
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
