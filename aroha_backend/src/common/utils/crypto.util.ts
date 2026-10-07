import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function hashWithPepper(value: string, pepper: string): string {
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function randomBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
