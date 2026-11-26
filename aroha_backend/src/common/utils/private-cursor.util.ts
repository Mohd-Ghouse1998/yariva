import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const nonceLength = 12;
const tagLength = 16;

function cursorKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("yariva:private-cursor:v1").digest();
}

export function sealPrivateCursor(value: string, secret: string, scope: string): string {
  const nonce = randomBytes(nonceLength);
  const cipher = createCipheriv("aes-256-gcm", cursorKey(secret), nonce);
  cipher.setAAD(Buffer.from(scope));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function openPrivateCursor(token: string, secret: string, scope: string): string {
  if (token.length > 1024 || !/^[a-zA-Z0-9_-]+$/.test(token)) throw new Error("Invalid cursor encoding");
  const value = Buffer.from(token, "base64url");
  const tagEnd = nonceLength + tagLength;
  if (value.length <= tagEnd) throw new Error("Invalid cursor length");
  const decipher = createDecipheriv("aes-256-gcm", cursorKey(secret), value.subarray(0, nonceLength), { authTagLength: tagLength });
  decipher.setAAD(Buffer.from(scope));
  decipher.setAuthTag(value.subarray(nonceLength, tagEnd));
  return Buffer.concat([decipher.update(value.subarray(tagEnd)), decipher.final()]).toString("utf8");
}
