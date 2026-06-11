import { NextResponse } from "next/server";
import { getEnabledConnectors } from "@/lib/connectors";
import { geocodeZip } from "@/lib/geo";

export async function POST() {
  const coords = geocodeZip("43040")!;
  const connectors = getEnabledConnectors();
  const results: Record<string, { count: number; error?: string }> = {};

  for (const connector of connectors) {
    try {
      const data = await connector.search({
        query: "Ohio State flag",
        zip: "43040",
        latitude: coords.lat,
        longitude: coords.lng,
        radiusMiles: 25,
      });
      results[connector.name] = { count: data.length };
    } catch (err) {
      results[connector.name] = {
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({ testQuery: "Ohio State flag", zip: "43040", results });
}
