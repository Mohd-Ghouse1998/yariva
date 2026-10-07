export type DistanceBandValue = "LOCAL" | "NEARBY" | "CITY_EDGE" | "REGIONAL";

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveDistanceBand(distanceKm: number): DistanceBandValue {
  if (distanceKm <= 10) {
    return "LOCAL";
  }
  if (distanceKm <= 25) {
    return "NEARBY";
  }
  if (distanceKm <= 50) {
    return "CITY_EDGE";
  }
  return "REGIONAL";
}

export function resolveDistanceBandScore(
  distanceKm: number,
  maxDistanceKm: number,
): number {
  if (distanceKm <= 10) {
    return 1;
  }
  if (distanceKm <= 25) {
    return 0.8;
  }
  if (distanceKm <= 50) {
    return 0.6;
  }
  if (distanceKm <= maxDistanceKm) {
    return 0.4;
  }
  return 0;
}

export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm);
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
