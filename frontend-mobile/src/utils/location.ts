// Robust location capture with several fall-backs that handle the common
// Android emulator failure modes:
//
// 1. Permission check (no implicit prompt loop).
// 2. Try last-known position first — instantaneous when available.
// 3. Try a low-accuracy fix (network/wifi) with a short timeout.
// 4. Fall back to a hardcoded city centroid if the user picked one
//    from the city presets.
//
// The function reports a structured result so the UI can show a precise
// reason instead of a generic "Couldn't get your location".

import * as Location from "expo-location";

export interface LocationResult {
  ok: true;
  latitude: number;
  longitude: number;
  source: "lastKnown" | "current" | "preset";
  city?: string;
  region?: string;
  countryCode?: string;
}

export interface LocationFailure {
  ok: false;
  reason:
    | "permission_denied"
    | "services_disabled"
    | "no_fix"
    | "timeout"
    | "unknown";
  message: string;
}

export type LocationOutcome = LocationResult | LocationFailure;

const DEFAULT_TIMEOUT_MS = 8_000;

export const CITY_PRESETS: Array<{
  label: string;
  city: string;
  region: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}> = [
  { label: "Bengaluru, IN", city: "Bengaluru", region: "Karnataka", countryCode: "IN", latitude: 12.9716, longitude: 77.5946 },
  { label: "Mumbai, IN", city: "Mumbai", region: "Maharashtra", countryCode: "IN", latitude: 19.0760, longitude: 72.8777 },
  { label: "Delhi, IN", city: "Delhi", region: "Delhi", countryCode: "IN", latitude: 28.6139, longitude: 77.2090 },
  { label: "Hyderabad, IN", city: "Hyderabad", region: "Telangana", countryCode: "IN", latitude: 17.3850, longitude: 78.4867 },
  { label: "Chennai, IN", city: "Chennai", region: "Tamil Nadu", countryCode: "IN", latitude: 13.0827, longitude: 80.2707 },
  { label: "Pune, IN", city: "Pune", region: "Maharashtra", countryCode: "IN", latitude: 18.5204, longitude: 73.8567 },
  { label: "Kolkata, IN", city: "Kolkata", region: "West Bengal", countryCode: "IN", latitude: 22.5726, longitude: 88.3639 },
  { label: "Ahmedabad, IN", city: "Ahmedabad", region: "Gujarat", countryCode: "IN", latitude: 23.0225, longitude: 72.5714 },
  { label: "Jaipur, IN", city: "Jaipur", region: "Rajasthan", countryCode: "IN", latitude: 26.9124, longitude: 75.7873 },
  { label: "London, GB", city: "London", region: "England", countryCode: "GB", latitude: 51.5074, longitude: -0.1278 },
  { label: "New York, US", city: "New York", region: "New York", countryCode: "US", latitude: 40.7128, longitude: -74.0060 },
  { label: "San Francisco, US", city: "San Francisco", region: "California", countryCode: "US", latitude: 37.7749, longitude: -122.4194 },
];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function tryReverseGeocode(latitude: number, longitude: number): Promise<{
  city?: string;
  region?: string;
  countryCode?: string;
}> {
  try {
    const places = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      4000,
      "reverseGeocodeAsync",
    );
    const place = places[0];
    if (!place) return {};
    return {
      city: place.city ?? place.subregion ?? undefined,
      region: place.region ?? undefined,
      countryCode: place.isoCountryCode ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function captureCurrentLocation(): Promise<LocationOutcome> {
  // Permissions
  const perm = await Location.getForegroundPermissionsAsync();
  let status = perm.status;
  if (status !== "granted") {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return {
      ok: false,
      reason: "permission_denied",
      message: "Location permission was denied. You can pick a city below instead.",
    };
  }

  // Service enabled?
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return {
        ok: false,
        reason: "services_disabled",
        message: "Turn on Location services in your device settings, or pick a city below.",
      };
    }
  } catch {
    // Some platforms throw — ignore and let the position calls report failure.
  }

  // Try last-known first; instantaneous if available.
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (last) {
      const meta = await tryReverseGeocode(last.coords.latitude, last.coords.longitude);
      return {
        ok: true,
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
        source: "lastKnown",
        ...meta,
      };
    }
  } catch {
    // fall through
  }

  // Try a low-accuracy reading with a short timeout. The Android emulator
  // often returns very slowly on Balanced/High; Lowest works against the
  // network provider.
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
      DEFAULT_TIMEOUT_MS,
      "getCurrentPositionAsync",
    );
    const meta = await tryReverseGeocode(pos.coords.latitude, pos.coords.longitude);
    return {
      ok: true,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      source: "current",
      ...meta,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const isTimeout = /timed out/i.test(message);
    return {
      ok: false,
      reason: isTimeout ? "timeout" : "no_fix",
      message: isTimeout
        ? "Couldn't get a GPS fix in time. Pick a city below — you can update later."
        : "We couldn't read your position. Pick a city below to keep going.",
    };
  }
}
