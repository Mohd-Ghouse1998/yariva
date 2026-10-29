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
  const count = params?.days;
  // Hermes may omit PluralRules. For our supported en/hi/te day counts,
  // the only nonzero integer in the singular category is 1.
  const plural = typeof count === "number" && Number.isFinite(count)
    ? count === 0 ? "zero"
      : typeof Intl.PluralRules === "function" ? new Intl.PluralRules(language).select(count)
        : count === 1 ? "one" : "other"
    : null;
  const resolvedKey = plural && (resources[language][`${key}.${plural}`] || english[`${key}.${plural}`])
    ? `${key}.${plural}` : key;
  const casualKey = `${resolvedKey}.casual`;
  const template =
    (tone === "hyderabad-casual"
      ? resources[language][casualKey] ?? english[casualKey]
      : null) ??
    resources[language][resolvedKey] ??
    english[resolvedKey] ??
    key;
  return Object.entries(params ?? {}).reduce(
    (copy, [name, replacement]) => copy.replaceAll(`{{${name}}}`, String(replacement)),
    template,
  );
}
