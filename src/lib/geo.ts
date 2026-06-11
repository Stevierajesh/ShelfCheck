// Known ZIP code coordinates for MVP
const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  "43040": { lat: 40.2365, lng: -83.3671 }, // Marysville, OH
  "43016": { lat: 40.0992, lng: -83.1538 }, // Dublin, OH
  "43017": { lat: 40.1173, lng: -83.1685 }, // Dublin, OH
  "43065": { lat: 40.1726, lng: -83.1460 }, // Powell, OH
  "43081": { lat: 40.1048, lng: -82.9304 }, // Westerville, OH
  "43015": { lat: 40.3073, lng: -83.0685 }, // Delaware, OH
  "43210": { lat: 39.9979, lng: -83.0178 }, // OSU campus, Columbus
  "43201": { lat: 39.9929, lng: -83.0105 }, // Columbus near campus
  "43235": { lat: 40.0993, lng: -82.9787 }, // Worthington/Columbus
};

export function geocodeZip(zip: string): { lat: number; lng: number } | null {
  if (ZIP_COORDS[zip]) return ZIP_COORDS[zip];
  // For unknown ZIPs, return null - caller should handle
  return null;
}

// Haversine distance in miles
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
