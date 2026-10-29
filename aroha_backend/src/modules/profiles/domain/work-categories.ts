import { OccupationCategory } from "../../../generated/prisma/client";

// One catalog supplies validation values and labels for both mobile entry points.
const labels: Record<OccupationCategory, string> = {
  TECHNOLOGY: "Technology",
  HEALTHCARE: "Healthcare",
  EDUCATION: "Education",
  CREATIVE: "Creative & design",
  BUSINESS: "Business",
  HOSPITALITY: "Hospitality",
  STUDENT: "Student",
  OTHER: "Other",
};
export const WORK_CATEGORY_VALUES = Object.values(OccupationCategory);
export const WORK_CATEGORIES = WORK_CATEGORY_VALUES.map((value) => ({
  value,
  label: labels[value],
}));
