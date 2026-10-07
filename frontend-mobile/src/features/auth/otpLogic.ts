export function normalizeOtpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isValidOtpCode(value: string): boolean {
  return /^\d{4,10}$/.test(value);
}

export function isLikelyInternationalPhone(value: string): boolean {
  const compact = value.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(compact);
}

export function maskPhone(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (compact.length <= 6) return compact;
  return `${compact.slice(0, 3)}••••${compact.slice(-4)}`;
}
