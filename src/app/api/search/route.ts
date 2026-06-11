import { NextRequest, NextResponse } from "next/server";
import { executeSearch } from "@/lib/search";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("query") || "";
  const zip = params.get("zip") || "43040";
  const radius = parseInt(params.get("radius") || "25", 10);
  const hideOnlineOnly = params.get("hideOnlineOnly") === "true";
  const inStoreOnly = params.get("inStoreOnly") === "true";

  if (!query.trim()) {
    return NextResponse.json(
      { error: "Query parameter is required" },
      { status: 400 }
    );
  }

  const radiusMiles = [5, 10, 25, 50].includes(radius) ? radius : 25;

  try {
    const results = await executeSearch({
      query: query.trim(),
      zip,
      radiusMiles,
      hideOnlineOnly,
      inStoreOnly,
    });

    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    console.error("[API/search] Error:", err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
