/** Decode only PNG's 24-byte signature/IHDR header, without loading the full bitmap. */
export const recapPngSize = (base64: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  let buffer = 0,
    bits = 0;
  for (const character of base64.slice(0, 32)) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("Invalid PNG encoding");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 24 ||
    signature.some((value, index) => bytes[index] !== value) ||
    [73, 72, 68, 82].some((value, index) => bytes[index + 12] !== value)
  )
    throw new Error("Invalid PNG header");
  const number = (offset: number) =>
    bytes.slice(offset, offset + 4).reduce((result, value) => result * 256 + value, 0);
  return { width: number(16), height: number(20) };
};
