// Enum values mirrored exactly from the Aroha backend (prisma/schema.prisma).
// These string unions intentionally match the backend casing so payloads can be
// passed through without translation.

export const USER_ROLE = ["USER", "MODERATOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLE)[number];

export const USER_STATUS = ["ACTIVE", "RESTRICTED", "SUSPENDED", "BANNED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const CLIENT_PLATFORM = ["IOS", "ANDROID", "WEB", "UNKNOWN"] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORM)[number];

export const PUSH_PROVIDER = ["APNS", "FCM"] as const;
export type PushProvider = (typeof PUSH_PROVIDER)[number];

export const PROFILE_GENDER = [
  "WOMAN",
  "MAN",
  "NON_BINARY",
  "TRANS_WOMAN",
  "TRANS_MAN",
  "AGENDER",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;
export type ProfileGender = (typeof PROFILE_GENDER)[number];

export const CONNECTION_INTENT = [
  "FRIENDSHIP",
  "COMPANIONSHIP",
  "SHARED_INTERESTS",
  "RELATIONSHIP",
  "DATING",
  "COMMITTED_RELATIONSHIP",
  "MARRIAGE_MINDED",
] as const;
export type ConnectionIntent = (typeof CONNECTION_INTENT)[number];

export const PROFILE_VERIFICATION_STATUS = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;
export type ProfileVerificationStatus = (typeof PROFILE_VERIFICATION_STATUS)[number];

export const RELATIONSHIP_PACE = [
  "SLOW_AND_STEADY",
  "OPEN_TO_EXPLORING",
  "INTENTIONAL",
  "READY_TO_COMMIT",
] as const;
export type RelationshipPace = (typeof RELATIONSHIP_PACE)[number];

export const PHOTO_MODERATION_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;
export type PhotoModerationStatus = (typeof PHOTO_MODERATION_STATUS)[number];

export const SMOKING_HABIT = ["NEVER", "OCCASIONAL", "REGULAR", "PREFER_NOT_TO_SAY"] as const;
export type SmokingHabit = (typeof SMOKING_HABIT)[number];

export const DRINKING_HABIT = [
  "NEVER",
  "OCCASIONAL",
  "SOCIAL",
  "REGULAR",
  "PREFER_NOT_TO_SAY",
] as const;
export type DrinkingHabit = (typeof DRINKING_HABIT)[number];

export const EXERCISE_HABIT = ["NEVER", "OCCASIONAL", "WEEKLY", "FREQUENT"] as const;
export type ExerciseHabit = (typeof EXERCISE_HABIT)[number];

export const DIET_PREFERENCE = [
  "OMNIVORE",
  "VEGETARIAN",
  "VEGAN",
  "PESCATARIAN",
  "HALAL",
  "KOSHER",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;
export type DietPreference = (typeof DIET_PREFERENCE)[number];

export const PET_PREFERENCE = [
  "HAS_PETS",
  "LIKES_PETS",
  "NO_PETS",
  "ALLERGIC",
  "PREFER_NOT_TO_SAY",
] as const;
export type PetPreference = (typeof PET_PREFERENCE)[number];

export const SLEEP_PATTERN = ["EARLY_BIRD", "FLEXIBLE", "NIGHT_OWL"] as const;
export type SleepPattern = (typeof SLEEP_PATTERN)[number];

export const SOCIAL_ENERGY_LEVEL = ["LOW_KEY", "BALANCED", "OUTGOING"] as const;
export type SocialEnergyLevel = (typeof SOCIAL_ENERGY_LEVEL)[number];

export const LIKE_STATUS = ["ACTIVE", "MATCHED", "RETRACTED"] as const;
export type LikeStatus = (typeof LIKE_STATUS)[number];

export const MATCH_STATUS = ["ACTIVE", "ENDED"] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const MATCH_END_REASON = ["UNMATCHED", "BLOCKED", "MODERATION", "ACCOUNT_DELETED"] as const;
export type MatchEndReason = (typeof MATCH_END_REASON)[number];

export const CONVERSATION_STATUS = [
  "ACTIVE",
  "BLOCKED",
  "CLOSED_UNMATCHED",
  "CLOSED_MODERATION",
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUS)[number];

export const CONVERSATION_CLOSE_REASON = [
  "BLOCKED",
  "UNMATCHED",
  "MODERATION",
  "ACCOUNT_DELETED",
] as const;
export type ConversationCloseReason = (typeof CONVERSATION_CLOSE_REASON)[number];

export const MESSAGE_TYPE = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SYSTEM"] as const;
export type MessageType = (typeof MESSAGE_TYPE)[number];

export const CONTENT_MODERATION_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ContentModerationStatus = (typeof CONTENT_MODERATION_STATUS)[number];

export const MESSAGE_STATUS = [
  "ACTIVE",
  "PENDING_MODERATION",
  "REMOVED_BY_MODERATION",
  "DELETED_BY_SENDER",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export const CALL_TYPE = ["VOICE", "VIDEO"] as const;
export type CallType = (typeof CALL_TYPE)[number];

export const CALL_SESSION_STATUS = [
  "RINGING",
  "ACCEPTED",
  "CONNECTING",
  "CONNECTED",
  "DECLINED",
  "CANCELED",
  "MISSED",
  "ENDED",
  "TIMED_OUT",
  "FAILED",
] as const;
export type CallSessionStatus = (typeof CALL_SESSION_STATUS)[number];

export const CALL_END_REASON = [
  "HANGUP",
  "DECLINED",
  "CANCELED",
  "MISSED",
  "BLOCKED",
  "UNMATCHED",
  "PERMISSION_REVOKED",
  "TIMEOUT",
  "ERROR",
] as const;
export type CallEndReason = (typeof CALL_END_REASON)[number];

export const REPORT_TARGET_TYPE = [
  "EVENT_LISTING",
  "USER",
  "MESSAGE",
  "PROFILE_PHOTO",
  "CONVERSATION",
  "MATCH",
  "CALL_SESSION",
  "PRIVATE_STORY",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPE)[number];

export const REPORT_REASON_CODE = [
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE_CONTENT",
  "FAKE_PROFILE",
  "UNDERAGE",
  "SAFETY_RISK",
  "OTHER",
] as const;
export type ReportReasonCode = (typeof REPORT_REASON_CODE)[number];

export const REPORT_STATUS = ["OPEN", "UNDER_REVIEW", "ACTIONED", "CLOSED", "DUPLICATE"] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];

export const NOTIFICATION_TYPE = [
  "NEW_LIKE",
  "NEW_MATCH",
  "NEW_MESSAGE",
  "MISSED_CALL",
  "DATE_PROPOSED",
  "DATE_ACCEPTED",
  "DATE_CHANGED",
  "DATE_CANCELLED",
  "DATE_REMINDER",
  "SAFETY_CHECK_IN",
  "MUTUAL_MEET_AGAIN",
  "REPORT_UPDATE",
  "MODERATION_ACTION",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

export const NOTIFICATION_STATUS = ["PENDING", "SENT", "FAILED", "READ", "CANCELED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];

export const NOTIFICATION_CHANNEL = ["IN_APP", "PUSH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

export const ANALYTICS_SOURCE = ["MOBILE", "SYSTEM", "ADMIN"] as const;
export type AnalyticsSource = (typeof ANALYTICS_SOURCE)[number];

export const PROFILE_COMPLETION_CRITERION = [
  "DISPLAY_NAME",
  "BIO",
  "DATE_OF_BIRTH",
  "AGE_18_PLUS",
  "CITY",
  "REGION",
  "COUNTRY_CODE",
  "LOCATION_COORDINATES",
  "LOCATION_GEOHASH",
  "INTENT",
  "APPROVED_PHOTO",
  "APPROVED_PRIMARY_PHOTO",
  "DISCOVERY_PREFERENCE",
  "COMMUNICATION_PREFERENCE",
  "PROFILE_HIDDEN",
  "ACCOUNT_NOT_ACTIVE",
] as const;
export type ProfileCompletionCriterion = (typeof PROFILE_COMPLETION_CRITERION)[number];

export const DISTANCE_BAND = ["LOCAL", "NEARBY", "CITY_EDGE", "REGIONAL"] as const;
export type DistanceBand = (typeof DISTANCE_BAND)[number];

export const PROFILE_PROMPT_ID = [
  "ideal_sunday",
  "learn_together",
  "healthy_relationship",
  "made_my_week",
  "make_me_laugh",
] as const;
export type ProfilePromptId = (typeof PROFILE_PROMPT_ID)[number];
