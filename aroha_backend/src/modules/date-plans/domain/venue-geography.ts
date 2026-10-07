import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export function calculateMidpoint(left: Coordinate, right: Coordinate): Coordinate {
  assertCoordinate(left);
  assertCoordinate(right);
  if (left.latitude === right.latitude && left.longitude === right.longitude) return { ...left };

  const first = toCartesian(left);
  const second = toCartesian(right);
  const x = first.x + second.x;
  const y = first.y + second.y;
  const z = first.z + second.z;
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (magnitude < 1e-12) {
    throw new AppException(
      422,
      ERROR_CODES.VENUE_SUGGESTIONS_UNAVAILABLE,
      "A geographic center cannot be calculated for these locations",
    );
  }
  return {
    latitude: radiansToDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    longitude: normalizeLongitude(radiansToDegrees(Math.atan2(y, x))),
  };
}

// Equal-weight spherical centroid: independent of party order and robust at the date line.
export function calculateGroupCenter(points: readonly Coordinate[]): Coordinate {
  if (points.length !== 4) throw new AppException(422, ERROR_CODES.VENUE_SUGGESTIONS_UNAVAILABLE, "Four current locations are required");
  const sum = points.reduce((value, point) => {
    assertCoordinate(point);
    const p = toCartesian(point);
    return { x: value.x + p.x, y: value.y + p.y, z: value.z + p.z };
  }, { x: 0, y: 0, z: 0 });
  if (Math.hypot(sum.x, sum.y, sum.z) < 1e-12) throw new AppException(422, ERROR_CODES.VENUE_SUGGESTIONS_UNAVAILABLE, "Choose a public area instead");
  return { latitude: radiansToDegrees(Math.atan2(sum.z, Math.hypot(sum.x, sum.y))), longitude: normalizeLongitude(radiansToDegrees(Math.atan2(sum.y, sum.x))) };
}

function toCartesian(point: Coordinate): { x: number; y: number; z: number } {
  const latitude = degreesToRadians(point.latitude);
  const longitude = degreesToRadians(point.longitude);
  return {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  };
}

function assertCoordinate(point: Coordinate): void {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, "Invalid planning location");
  }
}

const degreesToRadians = (value: number): number => (value * Math.PI) / 180;
const radiansToDegrees = (value: number): number => (value * 180) / Math.PI;
const normalizeLongitude = (value: number): number => ((value + 540) % 360) - 180;
