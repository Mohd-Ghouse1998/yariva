import type { ProfilePromptId } from "../../types/enums";

export const PROFILE_PROMPTS = [
  { id: "ideal_sunday", label: "My ideal unhurried Sunday…" },
  { id: "learn_together", label: "Something I would love to learn with someone…" },
  { id: "healthy_relationship", label: "A relationship feels healthy to me when…" },
  { id: "made_my_week", label: "A small thing that made my week…" },
  { id: "make_me_laugh", label: "The quickest way to make me laugh…" },
] as const satisfies ReadonlyArray<{ id: ProfilePromptId; label: string }>;

export const profilePromptLabel = (promptId: string): string =>
  PROFILE_PROMPTS.find((prompt) => prompt.id === promptId)?.label ?? "A little more about me";
