export interface BlindPolicy {
  isBlindVibeActive: boolean;
  interactionCount: number;
  myCount: number;
  perParticipantTarget: number;
  revealThreshold: number;
  initialBlurRadius: number;
  myRevealConsent: boolean;
  otherRevealConsent: boolean;
  revealedAt: string | null;
}
export interface BlindEvent {
  occurrence: { id: string; startsAt: string; endsAt: string; timezone: string; city: string; state: "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED" };
  enrollment: { intent: "DATING" | "FRIENDSHIP"; notificationsEnabled: boolean; state: "JOINED" | "LEFT" } | null;
  matches: Array<{ conversationId: string; displayName: string }>;
}
export interface BlindPerson { userId: string; displayName: string; headline: string | null; interestSent: boolean }
