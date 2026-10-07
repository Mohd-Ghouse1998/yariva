const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision = 9,
): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let bit = 0;
  let current = 0;
  let isLongitude = true;
  let geohash = "";

  while (geohash.length < precision) {
    if (isLongitude) {
      const midpoint = (lngMin + lngMax) / 2;
      if (longitude >= midpoint) {
        current = (current << 1) + 1;
        lngMin = midpoint;
      } else {
        current <<= 1;
        lngMax = midpoint;
      }
    } else {
      const midpoint = (latMin + latMax) / 2;
      if (latitude >= midpoint) {
        current = (current << 1) + 1;
        latMin = midpoint;
      } else {
        current <<= 1;
        latMax = midpoint;
      }
    }

    isLongitude = !isLongitude;
    bit += 1;

    if (bit === 5) {
      geohash += BASE32[current];
      bit = 0;
      current = 0;
    }
  }

  return geohash;
}
