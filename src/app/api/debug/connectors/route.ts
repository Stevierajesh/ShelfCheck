import { NextResponse } from "next/server";
import { getAllConnectors } from "@/lib/connectors";

export async function GET() {
  const connectors = getAllConnectors();

  const info = connectors.map((c) => ({
    name: c.name,
    enabled: c.enabled(),
  }));

  const missingKeys: string[] = [];
  if (!process.env.GOOGLE_PLACES_API_KEY)
    missingKeys.push("GOOGLE_PLACES_API_KEY");
  if (!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY)
    missingKeys.push("GOOGLE_CUSTOM_SEARCH_API_KEY");
  if (!process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID)
    missingKeys.push("GOOGLE_CUSTOM_SEARCH_ENGINE_ID");
  if (!process.env.SERPAPI_API_KEY) missingKeys.push("SERPAPI_API_KEY");

  return NextResponse.json({ connectors: info, missingKeys });
}
