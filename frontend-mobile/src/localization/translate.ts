import en from "./resources/en.json";
import hi from "./resources/hi.json";
import te from "./resources/te.json";

export type AppLanguage = "en" | "hi" | "te";
export type CopyTone = "standard" | "hyderabad-casual";
export type TranslationParams = Record<string, string | number>;

const resources: Record<AppLanguage, Record<string, string>> = { en, hi, te };
const english = en as Record<string, string>;

export function translate(
  language: AppLanguage,
  tone: CopyTone,
  key: string,
  params?: TranslationParams,
): string {
  const casualKey = `${key}.casual`;
  const template =
    (tone === "hyderabad-casual"
      ? resources[language][casualKey] ?? english[casualKey]
      : null) ??
    resources[language][key] ??
    english[key] ??
    key;
  return Object.entries(params ?? {}).reduce(
    (copy, [name, replacement]) => copy.replaceAll(`{{${name}}}`, String(replacement)),
    template,
  );
}
