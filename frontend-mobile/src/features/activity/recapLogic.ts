import type { WeeklyRecap } from "../../types/activity";
import { translate } from "../../localization/translate";

export type RecapTranslator = (key: string) => string;
const english: RecapTranslator = (key) => translate("en", "standard", key);

export const RECAP_EXPORT = {
  width: 1080,
  height: 1920,
  margin: 96,
  previewMaxWidth: 260,
  cacheLifetimeMs: 86_400_000,
} as const;

export const recapPreviewSize = (availableWidth: number, availableHeight = Infinity) => {
  const width = Math.max(
    0,
    Math.min(RECAP_EXPORT.previewMaxWidth, availableWidth, (availableHeight * 9) / 16),
  );
  return { width, height: (width * RECAP_EXPORT.height) / RECAP_EXPORT.width };
};

const periodDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));

export const recapPeriod = (recap: WeeklyRecap) => ({
  start: periodDate(recap.periodStart),
  end: periodDate(recap.periodEnd),
});

/** A compact label is paired with exact, accessible cutoff details in the UI. */
export const recapPeriodLabel = (recap: WeeklyRecap) => {
  const date = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  return `${date(recap.periodStart)} – ${date(recap.periodEnd)}`;
};

export const recapHasActivity = (recap: WeeklyRecap) =>
  [recap.scenesPublished, recap.plansAccepted, recap.activityDays, recap.pointsEarned].some(
    (value) => value > 0,
  );

export const recapMetrics = (recap: WeeklyRecap, t: RecapTranslator = english) => [
  { label: t("activity.metric.scenes"), value: recap.scenesPublished },
  { label: t("activity.metric.plans"), value: recap.plansAccepted },
  { label: t("activity.metric.days"), value: recap.activityDays },
  { label: t("activity.metric.points"), value: recap.pointsEarned },
];

/** Explicit share allowlist: no identity, photos, URLs, tokens or account/report IDs. */
export const recapShareModel = (
  recap: WeeklyRecap,
  includeMetrics = false,
  t: RecapTranslator = english,
) => ({
  title: [t("activity.card.titleA"), t("activity.card.titleB")],
  subtitle: [t("activity.card.subtitleA"), t("activity.card.subtitleB")],
  period: recapPeriod(recap),
  metrics: includeMetrics && recap.historyAvailable ? recapMetrics(recap, t) : [],
  partial: includeMetrics && recap.historyAvailable && recap.partialHistory,
});
