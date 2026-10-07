import type { BlindPolicy } from "../../types/blind";
export function blindPresentation(policy: Pick<BlindPolicy, "isBlindVibeActive" | "interactionCount" | "revealThreshold" | "initialBlurRadius">) {
  const valid = Number.isFinite(policy.revealThreshold) && policy.revealThreshold > 0 && Number.isFinite(policy.initialBlurRadius) && policy.initialBlurRadius > 0;
  const count = valid && Number.isFinite(policy.interactionCount) ? Math.max(0, Math.min(policy.revealThreshold, policy.interactionCount)) : 0;
  return { count, progress: valid ? count / policy.revealThreshold : 0, blurRadius: policy.isBlindVibeActive ? valid ? policy.initialBlurRadius * (1 - count / policy.revealThreshold) : 20 : 0 };
}
