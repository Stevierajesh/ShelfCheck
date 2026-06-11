# MVP - Local Product Availability Search

Search for products and see nearby physical stores that may have them available for pickup or in-store purchase. Default location: ZIP 43040 (Marysville, OH).

## What it does

- Search for a product (e.g., "Ohio State flag")
- See nearby stores within a configurable radius (5/10/25/50 miles)
- Each result shows availability status, confidence level, data source, and evidence
- Filter by in-store/pickup only, or hide online-only results
- Mobile-first UI that works on phone browsers

## What it does NOT do

- Does not provide real-time inventory data (availability may be stale)
- Does not scrape retailer websites or bypass any anti-automation systems
- Does not guarantee any product is actually in stock — always call before driving
- Does not cover all retailers — only connectors with legal API access are implemented

## Quick start

```bash
# Install dependencies
npm install

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Start dev server
npm run dev
```

Open http://localhost:3000 on your phone or browser. Search "Ohio State flag" with ZIP 43040.

## Seeding data

The SeedDataConnector provides built-in sample data and works without any API keys. It includes sample stores near Marysville, OH (Walmart, Meijer, Kroger, Target, Rally House, Barnes & Noble OSU) with Ohio State flag products.

To persist seed data to the database, start the dev server and run:

```bash
curl -X POST http://localhost:3000/api/debug/seed
```

Or use the Admin page at http://localhost:3000/admin.

## API keys for optional connectors

Set these in `.env` to enable additional connectors:

| Variable | Connector | Notes |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | GooglePlacesConnector | Finds nearby stores by category. Set `ENABLE_GOOGLE_PLACES_CONNECTOR=true` |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | GoogleCustomSearchConnector | Web search for product availability. Also needs `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`. Set `ENABLE_GOOGLE_SEARCH_CONNECTOR=true` |
| `SERPAPI_API_KEY` | SerpApiConnector | Alternative web search. Set `ENABLE_SERPAPI_CONNECTOR=true` |

## Connectors

| Connector | Status | Notes |
|---|---|---|
| SeedDataConnector | Working | Built-in sample data, always available |
| GooglePlacesConnector | Working | Requires API key |
| GoogleCustomSearchConnector | Working | Requires API key + CX ID |
| SerpApiConnector | Working | Requires API key |
| WalmartConnector | Stub | Requires Walmart Affiliate API partnership |
| TargetConnector | Stub | No public API available |
| MeijerConnector | Stub | No public API available |
| KrogerConnector | Stub | Requires Kroger Developer API key |
| ShopifyMerchantConnector | Stub | Requires merchant Storefront API token |
| SquareMerchantConnector | Stub | Requires Square API key |
| GoogleMerchantLocalInventoryConnector | Stub | Requires Merchant Center API access |

## Availability confidence

Every result includes a confidence level:

- **HIGH** — Source explicitly confirms in-store stock, data is fresh
- **MEDIUM** — Source indicates likely availability (e.g., pickup mentioned in listing)
- **LOW** — Inference only; store may carry the category but inventory unverified

Seed data defaults to LOW or MEDIUM confidence. Always verify before driving.

## Testing

```bash
npm test
```

Tests cover: geocoding, distance calculation, result ranking, availability priority, seed connector output, and connector interface compliance.

## API routes

- `GET /api/search?query=&zip=43040&radius=25&hideOnlineOnly=true&inStoreOnly=false` — Search
- `GET /api/stores/:id` — Store detail with inventory offers
- `GET /api/debug/connectors` — List all connectors and their status
- `POST /api/debug/seed` — Import seed data to database
- `POST /api/debug/sync-test` — Run test search through all enabled connectors

## Project structure

```
src/
  app/              # Next.js pages and API routes
    page.tsx        # Main search page
    admin/page.tsx  # Admin/debug page
    store/[id]/     # Store detail page
    api/            # API routes
  lib/
    connectors/     # Data source connectors
    db.ts           # Prisma client
    geo.ts          # Geocoding and distance
    search.ts       # Search engine, ranking, dedup
    types.ts        # TypeScript types
  __tests__/        # Unit tests
prisma/
  schema.prisma     # Database schema
```

## Known limitations

- ZIP geocoding uses a hardcoded lookup table (only central Ohio ZIPs included)
- Deduplication is basic (normalized title + store name comparison)
- No background refresh of connector results
- External connector results are cached in-memory for 10 minutes (no persistent cache)
- Store hours are not populated in seed data
- No user authentication

## Next engineering priorities

1. **Integrate Kroger API** — Kroger has a public developer API that supports product/location search
2. **Add geocoding service** — Use a geocoding API to support arbitrary ZIP codes
3. **Background connector sync** — Periodically refresh results for popular queries
4. **Persistent result cache** — Store connector results in DB with TTL instead of in-memory
5. **UPC/barcode search** — Allow scanning or entering a UPC for exact product lookup
6. **Store hours integration** — Pull operating hours from Google Places to show "Open now" filter
7. **Walmart Affiliate API** — Apply for Walmart API access for real inventory data
