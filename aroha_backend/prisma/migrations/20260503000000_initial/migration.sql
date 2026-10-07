-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "ClientPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('APNS', 'FCM');

-- CreateEnum
CREATE TYPE "ProfileGender" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY', 'TRANS_WOMAN', 'TRANS_MAN', 'AGENDER', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ConnectionIntent" AS ENUM ('FRIENDSHIP', 'COMPANIONSHIP', 'SHARED_INTERESTS', 'RELATIONSHIP');

-- CreateEnum
CREATE TYPE "PhotoModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SmokingHabit" AS ENUM ('NEVER', 'OCCASIONAL', 'REGULAR', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "DrinkingHabit" AS ENUM ('NEVER', 'OCCASIONAL', 'SOCIAL', 'REGULAR', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ExerciseHabit" AS ENUM ('NEVER', 'OCCASIONAL', 'WEEKLY', 'FREQUENT');

-- CreateEnum
CREATE TYPE "DietPreference" AS ENUM ('OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'HALAL', 'KOSHER', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "PetPreference" AS ENUM ('HAS_PETS', 'LIKES_PETS', 'NO_PETS', 'ALLERGIC', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "SleepPattern" AS ENUM ('EARLY_BIRD', 'FLEXIBLE', 'NIGHT_OWL');

-- CreateEnum
CREATE TYPE "SocialEnergyLevel" AS ENUM ('LOW_KEY', 'BALANCED', 'OUTGOING');

-- CreateEnum
CREATE TYPE "LikeStatus" AS ENUM ('ACTIVE', 'MATCHED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "MatchEndReason" AS ENUM ('UNMATCHED', 'BLOCKED', 'MODERATION', 'ACCOUNT_DELETED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED_UNMATCHED', 'CLOSED_MODERATION');

-- CreateEnum
CREATE TYPE "ConversationCloseReason" AS ENUM ('BLOCKED', 'UNMATCHED', 'MODERATION', 'ACCOUNT_DELETED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ContentModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('ACTIVE', 'PENDING_MODERATION', 'REMOVED_BY_MODERATION', 'DELETED_BY_SENDER');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallSessionStatus" AS ENUM ('RINGING', 'ACCEPTED', 'CONNECTING', 'CONNECTED', 'DECLINED', 'CANCELED', 'MISSED', 'ENDED', 'TIMED_OUT', 'FAILED');

-- CreateEnum
CREATE TYPE "CallEndReason" AS ENUM ('HANGUP', 'DECLINED', 'CANCELED', 'MISSED', 'BLOCKED', 'UNMATCHED', 'PERMISSION_REVOKED', 'TIMEOUT', 'ERROR');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'MESSAGE', 'PROFILE_PHOTO', 'CONVERSATION', 'MATCH', 'CALL_SESSION');

-- CreateEnum
CREATE TYPE "ReportReasonCode" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'UNDERAGE', 'SAFETY_RISK', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'CLOSED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ModerationCaseType" AS ENUM ('USER_REPORT', 'PHOTO_REVIEW', 'TRUST_REVIEW', 'PROFILE_REVIEW', 'MESSAGE_REVIEW');

-- CreateEnum
CREATE TYPE "ModerationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTIONED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('NONE', 'NOTE_ONLY', 'WARN', 'REMOVE_PHOTO', 'HIDE_PROFILE', 'FREEZE_DISCOVERY', 'FREEZE_CHAT', 'FREEZE_CALLS', 'SHADOW_BAN', 'SUSPEND', 'BAN', 'RESTORE');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MATCH', 'NEW_MESSAGE', 'MISSED_CALL', 'REPORT_UPDATE', 'MODERATION_ACTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ', 'CANCELED');

-- CreateEnum
CREATE TYPE "FeatureFlagScope" AS ENUM ('GLOBAL', 'USER_PERCENTAGE', 'USER_ALLOWLIST');

-- CreateEnum
CREATE TYPE "AnalyticsSource" AS ENUM ('MOBILE', 'SYSTEM', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isShadowBanned" BOOLEAN NOT NULL DEFAULT false,
    "isDiscoveryFrozen" BOOLEAN NOT NULL DEFAULT false,
    "isChatFrozen" BOOLEAN NOT NULL DEFAULT false,
    "isCallFrozen" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" VARCHAR(128),
    "deviceName" VARCHAR(128),
    "platform" "ClientPlatform" NOT NULL DEFAULT 'UNKNOWN',
    "appVersion" VARCHAR(64),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "currentRefreshTokenHash" VARCHAR(128) NOT NULL,
    "currentRefreshTokenJti" VARCHAR(64) NOT NULL,
    "previousRefreshTokenHash" VARCHAR(128),
    "previousRefreshTokenJti" VARCHAR(64),
    "previousRefreshTokenGraceUntil" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" VARCHAR(128),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID,
    "token" VARCHAR(512) NOT NULL,
    "platform" "ClientPlatform" NOT NULL,
    "provider" "PushProvider" NOT NULL,
    "deviceId" VARCHAR(128),
    "lastSeenAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(80),
    "headline" VARCHAR(140),
    "bio" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "ProfileGender",
    "pronouns" VARCHAR(80),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "countryCode" CHAR(2),
    "locationLat" DECIMAL(9,6),
    "locationLng" DECIMAL(9,6),
    "locationGeohash" VARCHAR(12),
    "locationUpdatedAt" TIMESTAMP(3),
    "hideAge" BOOLEAN NOT NULL DEFAULT false,
    "hideDistance" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilePhoto" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "objectKey" VARCHAR(512) NOT NULL,
    "bucket" VARCHAR(128) NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" VARCHAR(128),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" "PhotoModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationReason" VARCHAR(500),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIntent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "intent" "ConnectionIntent" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestTag" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInterest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "interestTagId" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLifestyle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "smoking" "SmokingHabit",
    "drinking" "DrinkingHabit",
    "exercise" "ExerciseHabit",
    "diet" "DietPreference",
    "petPreference" "PetPreference",
    "sleepPattern" "SleepPattern",
    "socialEnergy" "SocialEnergyLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLifestyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSchedulePreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekdayMask" INTEGER NOT NULL DEFAULT 0,
    "timeBlockMask" INTEGER NOT NULL DEFAULT 0,
    "prefersWeekends" BOOLEAN NOT NULL DEFAULT false,
    "remoteFriendly" BOOLEAN NOT NULL DEFAULT false,
    "maxMeetupsPerWeek" INTEGER,
    "preferredLeadTimeDays" INTEGER,
    "timezone" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSchedulePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDiscoveryPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "maxDistanceKm" INTEGER,
    "intentFilter" "ConnectionIntent"[] DEFAULT ARRAY[]::"ConnectionIntent"[],
    "preferredGenders" "ProfileGender"[] DEFAULT ARRAY[]::"ProfileGender"[],
    "includeRecentlyActiveOnly" BOOLEAN NOT NULL DEFAULT false,
    "preferSameCity" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDiscoveryPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCommunicationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "allowVoiceCalls" BOOLEAN NOT NULL DEFAULT true,
    "allowVideoCalls" BOOLEAN NOT NULL DEFAULT true,
    "allowPushMatches" BOOLEAN NOT NULL DEFAULT true,
    "allowPushMessages" BOOLEAN NOT NULL DEFAULT true,
    "allowPushCalls" BOOLEAN NOT NULL DEFAULT true,
    "allowReadReceipts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCommunicationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Like" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "status" "LikeStatus" NOT NULL DEFAULT 'ACTIVE',
    "matchedAt" TIMESTAMP(3),
    "retractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pass" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "userLowId" UUID NOT NULL,
    "userHighId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" "MatchEndReason",
    "endedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCommunicationSetting" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "allowVoiceCalls" BOOLEAN NOT NULL DEFAULT true,
    "allowVideoCalls" BOOLEAN NOT NULL DEFAULT true,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchCommunicationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageSequence" INTEGER NOT NULL DEFAULT 0,
    "lastMessagePreview" VARCHAR(160),
    "lastMessageType" "MessageType",
    "lastMessageSentAt" TIMESTAMP(3),
    "lastSenderId" UUID,
    "closedAt" TIMESTAMP(3),
    "closedReason" "ConversationCloseReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "clientMessageId" VARCHAR(64),
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "textBody" TEXT,
    "attachmentObjectKey" VARCHAR(512),
    "attachmentBucket" VARCHAR(128),
    "attachmentMimeType" VARCHAR(128),
    "attachmentSizeBytes" INTEGER,
    "attachmentWidth" INTEGER,
    "attachmentHeight" INTEGER,
    "attachmentDurationSeconds" INTEGER,
    "attachmentModerationStatus" "ContentModerationStatus",
    "status" "MessageStatus" NOT NULL DEFAULT 'ACTIVE',
    "replyToMessageId" UUID,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationRead" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadMessageId" UUID,
    "lastReadSequence" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "initiatorUserId" UUID NOT NULL,
    "receiverUserId" UUID NOT NULL,
    "callType" "CallType" NOT NULL,
    "status" "CallSessionStatus" NOT NULL DEFAULT 'RINGING',
    "signalingVersion" INTEGER NOT NULL DEFAULT 1,
    "initiatorSessionId" UUID,
    "acceptedBySessionId" UUID,
    "ringStartedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedByUserId" UUID,
    "endReason" "CallEndReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" UUID NOT NULL,
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "reason" VARCHAR(500),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterUserId" UUID NOT NULL,
    "reportedUserId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "reasonCode" "ReportReasonCode" NOT NULL,
    "description" VARCHAR(2000),
    "targetMatchId" UUID,
    "targetConversationId" UUID,
    "targetMessageId" UUID,
    "targetPhotoId" UUID,
    "targetCallSessionId" UUID,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeKey" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" UUID NOT NULL,
    "subjectUserId" UUID NOT NULL,
    "sourceReportId" UUID,
    "caseType" "ModerationCaseType" NOT NULL,
    "priority" "ModerationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminUserId" UUID,
    "summary" VARCHAR(500),
    "findings" JSONB,
    "actionTaken" "ModerationAction" NOT NULL DEFAULT 'NONE',
    "actionNotes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScore" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 70,
    "level" "TrustLevel" NOT NULL DEFAULT 'HIGH',
    "factors" JSONB,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manualOverrideScore" INTEGER,
    "manualOverrideReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorUserId" UUID,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" VARCHAR(140) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" VARCHAR(255),
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "scope" "FeatureFlagScope" NOT NULL DEFAULT 'GLOBAL',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER,
    "variant" VARCHAR(50),
    "config" JSONB,
    "allowlistUserIds" JSONB,
    "createdByUserId" UUID,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "eventName" VARCHAR(120) NOT NULL,
    "source" "AnalyticsSource" NOT NULL DEFAULT 'MOBILE',
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorSessionId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(64),
    "targetUserId" UUID,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_status_deletedAt_idx" ON "User"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_currentRefreshTokenJti_key" ON "UserSession"("currentRefreshTokenJti");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserSession_refreshTokenExpiresAt_idx" ON "UserSession"("refreshTokenExpiresAt");

-- CreateIndex
CREATE INDEX "UserSession_lastSeenAt_idx" ON "UserSession"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_invalidatedAt_idx" ON "PushToken"("userId", "invalidatedAt");

-- CreateIndex
CREATE INDEX "PushToken_sessionId_idx" ON "PushToken"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_isComplete_isHidden_deletedAt_idx" ON "UserProfile"("isComplete", "isHidden", "deletedAt");

-- CreateIndex
CREATE INDEX "UserProfile_countryCode_city_idx" ON "UserProfile"("countryCode", "city");

-- CreateIndex
CREATE INDEX "UserProfile_locationGeohash_idx" ON "UserProfile"("locationGeohash");

-- CreateIndex
CREATE INDEX "ProfilePhoto_userId_moderationStatus_deletedAt_idx" ON "ProfilePhoto"("userId", "moderationStatus", "deletedAt");

-- CreateIndex
CREATE INDEX "ProfilePhoto_userId_isPrimary_deletedAt_idx" ON "ProfilePhoto"("userId", "isPrimary", "deletedAt");

-- CreateIndex
CREATE INDEX "ProfilePhoto_userId_position_idx" ON "ProfilePhoto"("userId", "position");

-- CreateIndex
CREATE INDEX "UserIntent_intent_deletedAt_idx" ON "UserIntent"("intent", "deletedAt");

-- CreateIndex
CREATE INDEX "UserIntent_userId_deletedAt_idx" ON "UserIntent"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIntent_userId_intent_key" ON "UserIntent"("userId", "intent");

-- CreateIndex
CREATE UNIQUE INDEX "InterestTag_slug_key" ON "InterestTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InterestTag_displayName_key" ON "InterestTag"("displayName");

-- CreateIndex
CREATE INDEX "InterestTag_category_isActive_idx" ON "InterestTag"("category", "isActive");

-- CreateIndex
CREATE INDEX "UserInterest_interestTagId_deletedAt_idx" ON "UserInterest"("interestTagId", "deletedAt");

-- CreateIndex
CREATE INDEX "UserInterest_userId_deletedAt_idx" ON "UserInterest"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserInterest_userId_interestTagId_key" ON "UserInterest"("userId", "interestTagId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLifestyle_userId_key" ON "UserLifestyle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSchedulePreference_userId_key" ON "UserSchedulePreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDiscoveryPreference_userId_key" ON "UserDiscoveryPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCommunicationPreference_userId_key" ON "UserCommunicationPreference"("userId");

-- CreateIndex
CREATE INDEX "Like_actorId_status_idx" ON "Like"("actorId", "status");

-- CreateIndex
CREATE INDEX "Like_targetId_status_idx" ON "Like"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Like_actorId_targetId_key" ON "Like"("actorId", "targetId");

-- CreateIndex
CREATE INDEX "Pass_actorId_expiresAt_deletedAt_idx" ON "Pass"("actorId", "expiresAt", "deletedAt");

-- CreateIndex
CREATE INDEX "Pass_targetId_expiresAt_deletedAt_idx" ON "Pass"("targetId", "expiresAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_actorId_targetId_key" ON "Pass"("actorId", "targetId");

-- CreateIndex
CREATE INDEX "Match_userLowId_status_idx" ON "Match"("userLowId", "status");

-- CreateIndex
CREATE INDEX "Match_userHighId_status_idx" ON "Match"("userHighId", "status");

-- CreateIndex
CREATE INDEX "Match_status_matchedAt_idx" ON "Match"("status", "matchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_userLowId_userHighId_key" ON "Match"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "MatchCommunicationSetting_userId_idx" ON "MatchCommunicationSetting"("userId");

-- CreateIndex
CREATE INDEX "MatchCommunicationSetting_matchId_idx" ON "MatchCommunicationSetting"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchCommunicationSetting_matchId_userId_key" ON "MatchCommunicationSetting"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

-- CreateIndex
CREATE INDEX "Conversation_status_lastMessageSentAt_idx" ON "Conversation"("status", "lastMessageSentAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_status_deletedAt_idx" ON "Message"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_sequence_key" ON "Message"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_senderId_clientMessageId_key" ON "Message"("conversationId", "senderId", "clientMessageId");

-- CreateIndex
CREATE INDEX "ConversationRead_userId_lastReadAt_idx" ON "ConversationRead"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "ConversationRead_conversationId_idx" ON "ConversationRead"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationRead_conversationId_userId_key" ON "ConversationRead"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "CallSession_matchId_status_idx" ON "CallSession"("matchId", "status");

-- CreateIndex
CREATE INDEX "CallSession_receiverUserId_status_idx" ON "CallSession"("receiverUserId", "status");

-- CreateIndex
CREATE INDEX "CallSession_initiatorUserId_status_idx" ON "CallSession"("initiatorUserId", "status");

-- CreateIndex
CREATE INDEX "CallSession_expiresAt_idx" ON "CallSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Block_blockerId_deletedAt_idx" ON "Block"("blockerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Block_blockedId_deletedAt_idx" ON "Block"("blockedId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_dedupeKey_key" ON "Report"("dedupeKey");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_status_createdAt_idx" ON "Report"("reportedUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterUserId_createdAt_idx" ON "Report"("reporterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetMessageId_idx" ON "Report"("targetMessageId");

-- CreateIndex
CREATE INDEX "Report_targetPhotoId_idx" ON "Report"("targetPhotoId");

-- CreateIndex
CREATE INDEX "ModerationCase_subjectUserId_status_idx" ON "ModerationCase"("subjectUserId", "status");

-- CreateIndex
CREATE INDEX "ModerationCase_priority_status_idx" ON "ModerationCase"("priority", "status");

-- CreateIndex
CREATE INDEX "ModerationCase_assignedAdminUserId_status_idx" ON "ModerationCase"("assignedAdminUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrustScore_userId_key" ON "TrustScore"("userId");

-- CreateIndex
CREATE INDEX "TrustScore_score_idx" ON "TrustScore"("score");

-- CreateIndex
CREATE INDEX "TrustScore_level_lastComputedAt_idx" ON "TrustScore"("level", "lastComputedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_scope_enabled_idx" ON "FeatureFlag"("scope", "enabled");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_occurredAt_idx" ON "AnalyticsEvent"("eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_occurredAt_idx" ON "AnalyticsEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_occurredAt_idx" ON "AnalyticsEvent"("sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIntent" ADD CONSTRAINT "UserIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_interestTagId_fkey" FOREIGN KEY ("interestTagId") REFERENCES "InterestTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLifestyle" ADD CONSTRAINT "UserLifestyle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchedulePreference" ADD CONSTRAINT "UserSchedulePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDiscoveryPreference" ADD CONSTRAINT "UserDiscoveryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationPreference" ADD CONSTRAINT "UserCommunicationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCommunicationSetting" ADD CONSTRAINT "MatchCommunicationSetting_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCommunicationSetting" ADD CONSTRAINT "MatchCommunicationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_initiatorUserId_fkey" FOREIGN KEY ("initiatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetMatchId_fkey" FOREIGN KEY ("targetMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetConversationId_fkey" FOREIGN KEY ("targetConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetPhotoId_fkey" FOREIGN KEY ("targetPhotoId") REFERENCES "ProfilePhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetCallSessionId_fkey" FOREIGN KEY ("targetCallSessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScore" ADD CONSTRAINT "TrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorSessionId_fkey" FOREIGN KEY ("actorSessionId") REFERENCES "UserSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
