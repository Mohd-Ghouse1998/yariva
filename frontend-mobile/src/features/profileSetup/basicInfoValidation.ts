export interface BasicInfoTextFields {
  displayName: string;
  pronouns: string;
  city: string;
  region: string;
  countryCode: string;
}

export const validateBasicInfoText = (fields: BasicInfoTextFields): string | null => {
  const displayName = fields.displayName.trim();
  if (displayName.length < 2) return "Please enter your name (at least 2 characters).";
  if (displayName.length > 80) return "Keep your name within 80 characters.";
  if (fields.pronouns.trim().length > 80) return "Keep your pronouns within 80 characters.";
  if (!fields.city.trim() || !fields.region.trim()) {
    return "Add your city, region, and 2-letter country code.";
  }
  if (fields.city.trim().length > 120) return "Keep your city within 120 characters.";
  if (fields.region.trim().length > 120) return "Keep your region within 120 characters.";
  if (!/^[A-Za-z]{2}$/.test(fields.countryCode.trim())) {
    return "Enter a valid 2-letter country code, such as IN.";
  }
  return null;
};
