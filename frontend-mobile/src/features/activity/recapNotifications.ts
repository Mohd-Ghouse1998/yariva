import type { PushRegistrationResult } from "../../notifications/pushRegistration";

/** Consent is saved only after a real native registration; disabling never prompts. */
export async function changeRecapNotifications(
  enabled: boolean,
  register: (requestPermission: boolean) => Promise<PushRegistrationResult>,
  save: (enabled: boolean) => Promise<boolean>,
): Promise<"SAVED" | "UNAVAILABLE" | "SAVE_FAILED"> {
  if (enabled && (await register(true)) !== "REGISTERED") return "UNAVAILABLE";
  return (await save(enabled)) ? "SAVED" : "SAVE_FAILED";
}
