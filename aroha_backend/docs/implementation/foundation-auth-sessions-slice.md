FILE: package.json
```json
{
  "name": "aroha-backend",
  "version": "0.1.0",
  "private": true,
  "description": "Aroha backend modular monolith",
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./tests/jest-e2e.json",
    "prisma:generate": "prisma generate --config prisma.config.ts",
    "prisma:migrate:dev": "prisma migrate dev --config prisma.config.ts",
    "prisma:migrate:deploy": "prisma migrate deploy --config prisma.config.ts",
    "prisma:studio": "prisma studio --config prisma.config.ts"
  },
  "dependencies": {
    "@nestjs/bullmq": "^11.0.2",
    "@nestjs/common": "^11.0.6",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.6",
    "@nestjs/jwt": "^11.0.1",
    "@nestjs/platform-express": "^11.0.6",
    "@nestjs/throttler": "^6.4.0",
    "@prisma/adapter-pg": "^7.7.0",
    "@prisma/client": "^7.7.0",
    "bcryptjs": "^2.4.3",
    "bullmq": "^5.56.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "dotenv": "^16.5.0",
    "helmet": "^8.1.0",
    "ioredis": "^5.5.0",
    "joi": "^17.13.3",
    "libphonenumber-js": "^1.12.8",
    "pg": "^8.13.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.5",
    "@nestjs/schematics": "^11.0.4",
    "@nestjs/testing": "^11.0.6",
    "@types/express": "^5.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.15.3",
    "@types/supertest": "^6.0.3",
    "jest": "^29.7.0",
    "prisma": "^7.7.0",
    "supertest": "^7.1.1",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  }
}

```

FILE: .gitignore
```gitignore
node_modules
dist
coverage
.env
.env.local
.DS_Store
src/generated/prisma

```

FILE: .env.example
```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
APP_NAME=aroha-backend

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aroha?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aroha_shadow?schema=public
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=300000
DATABASE_MAX_LIFETIME_SECONDS=0

REDIS_URL=redis://localhost:6379/0
BULLMQ_PREFIX=aroha

JWT_ACCESS_SECRET=replace-with-64-char-secret
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
REFRESH_TOKEN_GRACE_SECONDS=30
PASSWORD_PEPPER=replace-with-64-char-secret
REFRESH_TOKEN_PEPPER=replace-with-64-char-secret

OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin
OBJECT_STORAGE_FORCE_PATH_STYLE=true
OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS=profile-photos
OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS=message-attachments

```

FILE: tsconfig.json
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "incremental": true,
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "types": [
      "node",
      "jest"
    ]
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "prisma.config.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}

```

FILE: tsconfig.build.json
```json
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "**/*.spec.ts"
  ]
}

```

FILE: nest-cli.json
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}

```

FILE: prisma/schema.prisma
```prisma
generator client {
  provider               = "prisma-client"
  output                 = "../src/generated/prisma"
  runtime                = "nodejs"
  moduleFormat           = "cjs"
  generatedFileExtension = "ts"
  engineType             = "client"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  USER
  MODERATOR
  ADMIN
}

enum UserStatus {
  ACTIVE
  RESTRICTED
  SUSPENDED
  BANNED
  DELETED
}

enum ClientPlatform {
  IOS
  ANDROID
  WEB
  UNKNOWN
}

enum PushProvider {
  APNS
  FCM
}

enum ProfileGender {
  WOMAN
  MAN
  NON_BINARY
  TRANS_WOMAN
  TRANS_MAN
  AGENDER
  OTHER
  PREFER_NOT_TO_SAY
}

enum ConnectionIntent {
  FRIENDSHIP
  COMPANIONSHIP
  SHARED_INTERESTS
  RELATIONSHIP
}

enum PhotoModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum SmokingHabit {
  NEVER
  OCCASIONAL
  REGULAR
  PREFER_NOT_TO_SAY
}

enum DrinkingHabit {
  NEVER
  OCCASIONAL
  SOCIAL
  REGULAR
  PREFER_NOT_TO_SAY
}

enum ExerciseHabit {
  NEVER
  OCCASIONAL
  WEEKLY
  FREQUENT
}

enum DietPreference {
  OMNIVORE
  VEGETARIAN
  VEGAN
  PESCATARIAN
  HALAL
  KOSHER
  OTHER
  PREFER_NOT_TO_SAY
}

enum PetPreference {
  HAS_PETS
  LIKES_PETS
  NO_PETS
  ALLERGIC
  PREFER_NOT_TO_SAY
}

enum SleepPattern {
  EARLY_BIRD
  FLEXIBLE
  NIGHT_OWL
}

enum SocialEnergyLevel {
  LOW_KEY
  BALANCED
  OUTGOING
}

enum LikeStatus {
  ACTIVE
  MATCHED
  RETRACTED
}

enum MatchStatus {
  ACTIVE
  ENDED
}

enum MatchEndReason {
  UNMATCHED
  BLOCKED
  MODERATION
  ACCOUNT_DELETED
}

enum ConversationStatus {
  ACTIVE
  BLOCKED
  CLOSED_UNMATCHED
  CLOSED_MODERATION
}

enum ConversationCloseReason {
  BLOCKED
  UNMATCHED
  MODERATION
  ACCOUNT_DELETED
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  SYSTEM
}

enum ContentModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum MessageStatus {
  ACTIVE
  PENDING_MODERATION
  REMOVED_BY_MODERATION
  DELETED_BY_SENDER
}

enum CallType {
  VOICE
  VIDEO
}

enum CallSessionStatus {
  RINGING
  ACCEPTED
  CONNECTING
  CONNECTED
  DECLINED
  CANCELED
  MISSED
  ENDED
  TIMED_OUT
  FAILED
}

enum CallEndReason {
  HANGUP
  DECLINED
  CANCELED
  MISSED
  BLOCKED
  UNMATCHED
  PERMISSION_REVOKED
  TIMEOUT
  ERROR
}

enum ReportTargetType {
  USER
  MESSAGE
  PROFILE_PHOTO
  CONVERSATION
  MATCH
  CALL_SESSION
}

enum ReportReasonCode {
  SPAM
  HARASSMENT
  INAPPROPRIATE_CONTENT
  FAKE_PROFILE
  UNDERAGE
  SAFETY_RISK
  OTHER
}

enum ReportStatus {
  OPEN
  UNDER_REVIEW
  ACTIONED
  CLOSED
  DUPLICATE
}

enum ModerationCaseType {
  USER_REPORT
  PHOTO_REVIEW
  TRUST_REVIEW
  PROFILE_REVIEW
  MESSAGE_REVIEW
}

enum ModerationPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ModerationCaseStatus {
  OPEN
  IN_REVIEW
  ACTIONED
  CLOSED
}

enum ModerationAction {
  NONE
  NOTE_ONLY
  WARN
  REMOVE_PHOTO
  HIDE_PROFILE
  FREEZE_DISCOVERY
  FREEZE_CHAT
  FREEZE_CALLS
  SHADOW_BAN
  SUSPEND
  BAN
  RESTORE
}

enum TrustLevel {
  LOW
  MEDIUM
  HIGH
}

enum NotificationType {
  NEW_MATCH
  NEW_MESSAGE
  MISSED_CALL
  REPORT_UPDATE
  MODERATION_ACTION
  SYSTEM
}

enum NotificationChannel {
  IN_APP
  PUSH
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
  CANCELED
}

enum FeatureFlagScope {
  GLOBAL
  USER_PERCENTAGE
  USER_ALLOWLIST
}

enum AnalyticsSource {
  MOBILE
  SYSTEM
  ADMIN
}

model User {
  id                         String                       @id @default(uuid()) @db.Uuid
  /// PostgreSQL unique indexes allow multiple NULLs here, which matches the requirement.
  email                      String?                      @unique @db.VarChar(320)
  phone                      String?                      @unique @db.VarChar(32)
  passwordHash               String                       @db.VarChar(255)
  role                       UserRole                     @default(USER)
  status                     UserStatus                   @default(ACTIVE)
  isShadowBanned             Boolean                      @default(false)
  isDiscoveryFrozen          Boolean                      @default(false)
  isChatFrozen               Boolean                      @default(false)
  isCallFrozen               Boolean                      @default(false)
  lastActiveAt               DateTime?
  suspendedAt                DateTime?
  bannedAt                   DateTime?
  deletedAt                  DateTime?
  createdAt                  DateTime                     @default(now())
  updatedAt                  DateTime                     @updatedAt

  sessions                   UserSession[]
  pushTokens                 PushToken[]
  profile                    UserProfile?
  photos                     ProfilePhoto[]
  intents                    UserIntent[]
  interests                  UserInterest[]
  lifestyle                  UserLifestyle?
  schedulePreference         UserSchedulePreference?
  discoveryPreference        UserDiscoveryPreference?
  communicationPreference    UserCommunicationPreference?
  outgoingLikes              Like[]                       @relation("LikeActor")
  incomingLikes              Like[]                       @relation("LikeTarget")
  outgoingPasses             Pass[]                       @relation("PassActor")
  incomingPasses             Pass[]                       @relation("PassTarget")
  matchesLow                 Match[]                      @relation("MatchUserLow")
  matchesHigh                Match[]                      @relation("MatchUserHigh")
  matchCommunicationSettings MatchCommunicationSetting[]
  sentMessages               Message[]                    @relation("MessageSender")
  conversationReads          ConversationRead[]
  initiatedCalls             CallSession[]                @relation("CallInitiator")
  receivedCalls              CallSession[]                @relation("CallReceiver")
  blocksInitiated            Block[]                      @relation("Blocker")
  blocksReceived             Block[]                      @relation("Blocked")
  reportsFiled               Report[]                     @relation("ReportReporter")
  reportsAgainst             Report[]                     @relation("ReportReported")
  moderationCasesSubject     ModerationCase[]             @relation("ModerationSubject")
  moderationCasesAssigned    ModerationCase[]             @relation("ModerationAssignee")
  trustScore                 TrustScore?
  notifications              Notification[]               @relation("NotificationUser")
  notificationActors         Notification[]               @relation("NotificationActor")
  createdFeatureFlags        FeatureFlag[]                @relation("FeatureFlagCreator")
  analyticsEvents            AnalyticsEvent[]
  auditLogsActor             AuditLog[]                   @relation("AuditActor")
  auditLogsTargetUser        AuditLog[]                   @relation("AuditTargetUser")

  @@index([status, deletedAt])
  @@index([lastActiveAt])
}

model UserSession {
  id                            String           @id @default(uuid()) @db.Uuid
  userId                        String           @db.Uuid
  deviceId                      String?          @db.VarChar(128)
  deviceName                    String?          @db.VarChar(128)
  platform                      ClientPlatform   @default(UNKNOWN)
  appVersion                    String?          @db.VarChar(64)
  ipAddress                     String?          @db.VarChar(64)
  userAgent                     String?          @db.VarChar(500)
  currentRefreshTokenHash       String           @db.VarChar(128)
  currentRefreshTokenJti        String           @unique @db.VarChar(64)
  previousRefreshTokenHash      String?          @db.VarChar(128)
  previousRefreshTokenJti       String?          @db.VarChar(64)
  previousRefreshTokenGraceUntil DateTime?
  refreshTokenExpiresAt         DateTime
  lastSeenAt                    DateTime?
  revokedAt                     DateTime?
  revokedReason                 String?          @db.VarChar(128)
  deletedAt                     DateTime?
  createdAt                     DateTime         @default(now())
  updatedAt                     DateTime         @updatedAt

  user                          User             @relation(fields: [userId], references: [id], onDelete: Restrict)
  pushTokens                    PushToken[]
  analyticsEvents               AnalyticsEvent[]
  auditLogs                     AuditLog[]

  @@index([userId, revokedAt])
  @@index([refreshTokenExpiresAt])
  @@index([lastSeenAt])
}

model PushToken {
  id            String         @id @default(uuid()) @db.Uuid
  userId        String         @db.Uuid
  sessionId     String?        @db.Uuid
  token         String         @unique @db.VarChar(512)
  platform      ClientPlatform
  provider      PushProvider
  deviceId      String?        @db.VarChar(128)
  lastSeenAt    DateTime?
  invalidatedAt DateTime?
  deletedAt     DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  session       UserSession?   @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([userId, invalidatedAt])
  @@index([sessionId])
}

model UserProfile {
  id                String               @id @default(uuid()) @db.Uuid
  userId            String               @unique @db.Uuid
  displayName       String?              @db.VarChar(80)
  headline          String?              @db.VarChar(140)
  bio               String?              @db.Text
  dateOfBirth       DateTime?
  gender            ProfileGender?
  pronouns          String?              @db.VarChar(80)
  city              String?              @db.VarChar(120)
  region            String?              @db.VarChar(120)
  countryCode       String?              @db.Char(2)
  locationLat       Decimal?             @db.Decimal(9, 6)
  locationLng       Decimal?             @db.Decimal(9, 6)
  locationGeohash   String?              @db.VarChar(12)
  locationUpdatedAt DateTime?
  hideAge           Boolean              @default(false)
  hideDistance      Boolean              @default(false)
  isHidden          Boolean              @default(false)
  isComplete        Boolean              @default(false)
  completedAt       DateTime?
  deletedAt         DateTime?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  user              User                 @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([isComplete, isHidden, deletedAt])
  @@index([countryCode, city])
  @@index([locationGeohash])
}

model ProfilePhoto {
  id               String                @id @default(uuid()) @db.Uuid
  userId           String                @db.Uuid
  objectKey        String                @db.VarChar(512)
  bucket           String                @db.VarChar(128)
  mimeType         String                @db.VarChar(128)
  sizeBytes        Int
  width            Int?
  height           Int?
  sha256           String?               @db.VarChar(128)
  position         Int                   @default(0)
  isPrimary        Boolean               @default(false)
  moderationStatus PhotoModerationStatus @default(PENDING)
  moderationReason String?               @db.VarChar(500)
  reviewedAt       DateTime?
  approvedAt       DateTime?
  rejectedAt       DateTime?
  deletedAt        DateTime?
  createdAt        DateTime              @default(now())
  updatedAt        DateTime              @updatedAt

  user             User                  @relation(fields: [userId], references: [id], onDelete: Restrict)
  reports          Report[]              @relation("ReportTargetPhoto")

  @@index([userId, moderationStatus, deletedAt])
  @@index([userId, isPrimary, deletedAt])
  @@index([userId, position])
}

model UserIntent {
  id        String           @id @default(uuid()) @db.Uuid
  userId    String           @db.Uuid
  intent    ConnectionIntent
  deletedAt DateTime?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  user      User             @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([userId, intent])
  @@index([intent, deletedAt])
  @@index([userId, deletedAt])
}

model InterestTag {
  id          String         @id @default(uuid()) @db.Uuid
  slug        String         @unique @db.VarChar(80)
  displayName String         @unique @db.VarChar(120)
  category    String?        @db.VarChar(80)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  userInterests UserInterest[]

  @@index([category, isActive])
}

model UserInterest {
  id            String       @id @default(uuid()) @db.Uuid
  userId        String       @db.Uuid
  interestTagId String       @db.Uuid
  deletedAt     DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user          User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  interestTag   InterestTag  @relation(fields: [interestTagId], references: [id], onDelete: Restrict)

  @@unique([userId, interestTagId])
  @@index([interestTagId, deletedAt])
  @@index([userId, deletedAt])
}

model UserLifestyle {
  id            String            @id @default(uuid()) @db.Uuid
  userId        String            @unique @db.Uuid
  smoking       SmokingHabit?
  drinking      DrinkingHabit?
  exercise      ExerciseHabit?
  diet          DietPreference?
  petPreference PetPreference?
  sleepPattern  SleepPattern?
  socialEnergy  SocialEnergyLevel?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Restrict)
}

model UserSchedulePreference {
  id                    String   @id @default(uuid()) @db.Uuid
  userId                String   @unique @db.Uuid
  weekdayMask           Int      @default(0)
  timeBlockMask         Int      @default(0)
  prefersWeekends       Boolean  @default(false)
  remoteFriendly        Boolean  @default(false)
  maxMeetupsPerWeek     Int?
  preferredLeadTimeDays Int?
  timezone              String?  @db.VarChar(64)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User     @relation(fields: [userId], references: [id], onDelete: Restrict)
}

model UserDiscoveryPreference {
  id                        String             @id @default(uuid()) @db.Uuid
  userId                    String             @unique @db.Uuid
  minAge                    Int?
  maxAge                    Int?
  maxDistanceKm             Int?
  intentFilter              ConnectionIntent[] @default([])
  preferredGenders          ProfileGender[]    @default([])
  includeRecentlyActiveOnly Boolean            @default(false)
  preferSameCity            Boolean            @default(false)
  createdAt                 DateTime           @default(now())
  updatedAt                 DateTime           @updatedAt

  user                      User               @relation(fields: [userId], references: [id], onDelete: Restrict)
}

model UserCommunicationPreference {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @unique @db.Uuid
  allowVoiceCalls   Boolean  @default(true)
  allowVideoCalls   Boolean  @default(true)
  allowPushMatches  Boolean  @default(true)
  allowPushMessages Boolean  @default(true)
  allowPushCalls    Boolean  @default(true)
  allowReadReceipts Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id], onDelete: Restrict)
}

model Like {
  id         String     @id @default(uuid()) @db.Uuid
  actorId    String     @db.Uuid
  targetId   String     @db.Uuid
  status     LikeStatus @default(ACTIVE)
  matchedAt  DateTime?
  retractedAt DateTime?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  actor      User       @relation("LikeActor", fields: [actorId], references: [id], onDelete: Restrict)
  target     User       @relation("LikeTarget", fields: [targetId], references: [id], onDelete: Restrict)

  @@unique([actorId, targetId])
  @@index([actorId, status])
  @@index([targetId, status])
}

model Pass {
  id         String   @id @default(uuid()) @db.Uuid
  actorId    String   @db.Uuid
  targetId   String   @db.Uuid
  expiresAt  DateTime
  deletedAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  actor      User     @relation("PassActor", fields: [actorId], references: [id], onDelete: Restrict)
  target     User     @relation("PassTarget", fields: [targetId], references: [id], onDelete: Restrict)

  @@unique([actorId, targetId])
  @@index([actorId, expiresAt, deletedAt])
  @@index([targetId, expiresAt, deletedAt])
}

model Match {
  id                     String                     @id @default(uuid()) @db.Uuid
  /// Canonical sorted user pair. Application code must always place the smaller UUID into userLowId.
  userLowId              String                     @db.Uuid
  userHighId             String                     @db.Uuid
  status                 MatchStatus                @default(ACTIVE)
  matchedAt              DateTime                   @default(now())
  endedAt                DateTime?
  endedReason            MatchEndReason?
  endedByUserId          String?                    @db.Uuid
  createdAt              DateTime                   @default(now())
  updatedAt              DateTime                   @updatedAt

  userLow                User                       @relation("MatchUserLow", fields: [userLowId], references: [id], onDelete: Restrict)
  userHigh               User                       @relation("MatchUserHigh", fields: [userHighId], references: [id], onDelete: Restrict)
  communicationSettings  MatchCommunicationSetting[]
  conversation           Conversation?
  reports                Report[]                   @relation("ReportTargetMatch")
  callSessions           CallSession[]

  @@unique([userLowId, userHighId])
  @@index([userLowId, status])
  @@index([userHighId, status])
  @@index([status, matchedAt])
}

model MatchCommunicationSetting {
  id              String   @id @default(uuid()) @db.Uuid
  matchId         String   @db.Uuid
  userId          String   @db.Uuid
  allowVoiceCalls Boolean  @default(true)
  allowVideoCalls Boolean  @default(true)
  muted           Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  match           Match    @relation(fields: [matchId], references: [id], onDelete: Restrict)
  user            User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([matchId, userId])
  @@index([userId])
  @@index([matchId])
}

model Conversation {
  id                  String                  @id @default(uuid()) @db.Uuid
  matchId             String                  @unique @db.Uuid
  status              ConversationStatus      @default(ACTIVE)
  lastMessageSequence Int                     @default(0)
  lastMessagePreview  String?                 @db.VarChar(160)
  lastMessageType     MessageType?
  lastMessageSentAt   DateTime?
  lastSenderId        String?                 @db.Uuid
  closedAt            DateTime?
  closedReason        ConversationCloseReason?
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  match               Match                   @relation(fields: [matchId], references: [id], onDelete: Restrict)
  messages            Message[]
  reads               ConversationRead[]
  callSessions        CallSession[]
  reports             Report[]                @relation("ReportTargetConversation")

  @@index([status, lastMessageSentAt])
}

model Message {
  id                        String                   @id @default(uuid()) @db.Uuid
  conversationId            String                   @db.Uuid
  senderId                  String                   @db.Uuid
  sequence                  Int
  clientMessageId           String?                  @db.VarChar(64)
  type                      MessageType              @default(TEXT)
  textBody                  String?                  @db.Text
  attachmentObjectKey       String?                  @db.VarChar(512)
  attachmentBucket          String?                  @db.VarChar(128)
  attachmentMimeType        String?                  @db.VarChar(128)
  attachmentSizeBytes       Int?
  attachmentWidth           Int?
  attachmentHeight          Int?
  attachmentDurationSeconds Int?
  attachmentModerationStatus ContentModerationStatus?
  status                    MessageStatus            @default(ACTIVE)
  replyToMessageId          String?                  @db.Uuid
  editedAt                  DateTime?
  deletedAt                 DateTime?
  createdAt                 DateTime                 @default(now())
  updatedAt                 DateTime                 @updatedAt

  conversation              Conversation             @relation(fields: [conversationId], references: [id], onDelete: Restrict)
  sender                    User                     @relation("MessageSender", fields: [senderId], references: [id], onDelete: Restrict)
  replyToMessage            Message?                 @relation("MessageReplies", fields: [replyToMessageId], references: [id], onDelete: SetNull)
  replies                   Message[]                @relation("MessageReplies")
  reports                   Report[]                 @relation("ReportTargetMessage")

  @@unique([conversationId, sequence])
  @@unique([conversationId, senderId, clientMessageId])
  @@index([conversationId, createdAt])
  @@index([senderId, createdAt])
  @@index([status, deletedAt])
}

model ConversationRead {
  id                String       @id @default(uuid()) @db.Uuid
  conversationId    String       @db.Uuid
  userId            String       @db.Uuid
  lastReadMessageId String?      @db.Uuid
  lastReadSequence  Int          @default(0)
  lastReadAt        DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Restrict)
  user              User         @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([conversationId, userId])
  @@index([userId, lastReadAt])
  @@index([conversationId])
}

model CallSession {
  id                  String            @id @default(uuid()) @db.Uuid
  matchId             String            @db.Uuid
  conversationId      String            @db.Uuid
  initiatorUserId     String            @db.Uuid
  receiverUserId      String            @db.Uuid
  callType            CallType
  status              CallSessionStatus @default(RINGING)
  signalingVersion    Int               @default(1)
  initiatorSessionId  String?           @db.Uuid
  acceptedBySessionId String?           @db.Uuid
  ringStartedAt       DateTime?
  acceptedAt          DateTime?
  connectedAt         DateTime?
  endedAt             DateTime?
  expiresAt           DateTime
  endedByUserId       String?           @db.Uuid
  endReason           CallEndReason?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  match               Match             @relation(fields: [matchId], references: [id], onDelete: Restrict)
  conversation        Conversation      @relation(fields: [conversationId], references: [id], onDelete: Restrict)
  initiatorUser       User              @relation("CallInitiator", fields: [initiatorUserId], references: [id], onDelete: Restrict)
  receiverUser        User              @relation("CallReceiver", fields: [receiverUserId], references: [id], onDelete: Restrict)
  reports             Report[]          @relation("ReportTargetCall")

  @@index([matchId, status])
  @@index([receiverUserId, status])
  @@index([initiatorUserId, status])
  @@index([expiresAt])
}

model Block {
  id         String   @id @default(uuid()) @db.Uuid
  blockerId  String   @db.Uuid
  blockedId  String   @db.Uuid
  reason     String?  @db.VarChar(500)
  deletedAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  blocker    User     @relation("Blocker", fields: [blockerId], references: [id], onDelete: Restrict)
  blocked    User     @relation("Blocked", fields: [blockedId], references: [id], onDelete: Restrict)

  @@unique([blockerId, blockedId])
  @@index([blockerId, deletedAt])
  @@index([blockedId, deletedAt])
}

model Report {
  id                 String           @id @default(uuid()) @db.Uuid
  reporterUserId     String           @db.Uuid
  reportedUserId     String           @db.Uuid
  targetType         ReportTargetType
  reasonCode         ReportReasonCode
  description        String?          @db.VarChar(2000)
  targetMatchId      String?          @db.Uuid
  targetConversationId String?        @db.Uuid
  targetMessageId    String?          @db.Uuid
  targetPhotoId      String?          @db.Uuid
  targetCallSessionId String?         @db.Uuid
  status             ReportStatus     @default(OPEN)
  dedupeKey          String           @unique @db.VarChar(255)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  closedAt           DateTime?

  reporter           User             @relation("ReportReporter", fields: [reporterUserId], references: [id], onDelete: Restrict)
  reported           User             @relation("ReportReported", fields: [reportedUserId], references: [id], onDelete: Restrict)
  targetMatch        Match?           @relation("ReportTargetMatch", fields: [targetMatchId], references: [id], onDelete: SetNull)
  targetConversation Conversation?    @relation("ReportTargetConversation", fields: [targetConversationId], references: [id], onDelete: SetNull)
  targetMessage      Message?         @relation("ReportTargetMessage", fields: [targetMessageId], references: [id], onDelete: SetNull)
  targetPhoto        ProfilePhoto?    @relation("ReportTargetPhoto", fields: [targetPhotoId], references: [id], onDelete: SetNull)
  targetCallSession  CallSession?     @relation("ReportTargetCall", fields: [targetCallSessionId], references: [id], onDelete: SetNull)
  moderationCases    ModerationCase[]

  @@index([reportedUserId, status, createdAt])
  @@index([reporterUserId, createdAt])
  @@index([targetMessageId])
  @@index([targetPhotoId])
}

model ModerationCase {
  id                 String               @id @default(uuid()) @db.Uuid
  subjectUserId      String               @db.Uuid
  sourceReportId     String?              @db.Uuid
  caseType           ModerationCaseType
  priority           ModerationPriority   @default(MEDIUM)
  status             ModerationCaseStatus @default(OPEN)
  assignedAdminUserId String?             @db.Uuid
  summary            String?              @db.VarChar(500)
  findings           Json?
  actionTaken        ModerationAction     @default(NONE)
  actionNotes        String?              @db.VarChar(2000)
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt
  closedAt           DateTime?

  subjectUser        User                 @relation("ModerationSubject", fields: [subjectUserId], references: [id], onDelete: Restrict)
  sourceReport       Report?              @relation(fields: [sourceReportId], references: [id], onDelete: SetNull)
  assignedAdmin      User?                @relation("ModerationAssignee", fields: [assignedAdminUserId], references: [id], onDelete: SetNull)

  @@index([subjectUserId, status])
  @@index([priority, status])
  @@index([assignedAdminUserId, status])
}

model TrustScore {
  id                  String     @id @default(uuid()) @db.Uuid
  userId              String     @unique @db.Uuid
  score               Int        @default(70)
  level               TrustLevel @default(HIGH)
  factors             Json?
  lastComputedAt      DateTime   @default(now())
  manualOverrideScore Int?
  manualOverrideReason String?   @db.VarChar(500)
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  user                User       @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([score])
  @@index([level, lastComputedAt])
}

model Notification {
  id         String             @id @default(uuid()) @db.Uuid
  userId     String             @db.Uuid
  actorUserId String?           @db.Uuid
  type       NotificationType
  channel    NotificationChannel @default(IN_APP)
  title      String             @db.VarChar(140)
  body       String             @db.VarChar(500)
  data       Json?
  status     NotificationStatus @default(PENDING)
  dedupeKey  String?            @unique @db.VarChar(255)
  readAt     DateTime?
  sentAt     DateTime?
  failedAt   DateTime?
  deletedAt  DateTime?
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt

  user       User               @relation("NotificationUser", fields: [userId], references: [id], onDelete: Restrict)
  actorUser  User?              @relation("NotificationActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([userId, status, createdAt])
  @@index([userId, readAt])
}

model FeatureFlag {
  id               String           @id @default(uuid()) @db.Uuid
  key              String           @unique @db.VarChar(120)
  description      String?          @db.VarChar(500)
  scope            FeatureFlagScope @default(GLOBAL)
  enabled          Boolean          @default(false)
  rolloutPercentage Int?
  variant          String?          @db.VarChar(50)
  config           Json?
  allowlistUserIds Json?
  createdByUserId  String?          @db.Uuid
  deletedAt        DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  createdByUser    User?            @relation("FeatureFlagCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@index([scope, enabled])
}

model AnalyticsEvent {
  id         String         @id @default(uuid()) @db.Uuid
  userId     String?        @db.Uuid
  sessionId  String?        @db.Uuid
  eventName  String         @db.VarChar(120)
  source     AnalyticsSource @default(MOBILE)
  properties Json?
  occurredAt DateTime
  receivedAt DateTime       @default(now())

  user       User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  session    UserSession?   @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([eventName, occurredAt])
  @@index([userId, occurredAt])
  @@index([sessionId, occurredAt])
}

model AuditLog {
  id            String       @id @default(uuid()) @db.Uuid
  actorUserId   String?      @db.Uuid
  actorSessionId String?     @db.Uuid
  action        String       @db.VarChar(120)
  entityType    String       @db.VarChar(80)
  entityId      String?      @db.VarChar(64)
  targetUserId  String?      @db.Uuid
  ipAddress     String?      @db.VarChar(64)
  userAgent     String?      @db.VarChar(500)
  metadata      Json?
  createdAt     DateTime     @default(now())

  actorUser     User?        @relation("AuditActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  actorSession  UserSession? @relation(fields: [actorSessionId], references: [id], onDelete: SetNull)
  targetUser    User?        @relation("AuditTargetUser", fields: [targetUserId], references: [id], onDelete: SetNull)

  @@index([actorUserId, createdAt])
  @@index([entityType, entityId])
  @@index([targetUserId, createdAt])
}

```

FILE: prisma.config.ts
```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

```

FILE: jest.config.ts
```ts
import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
};

export default config;

```

FILE: tests/jest-e2e.json
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "tests/e2e/.*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}

```

FILE: docs/implementation/package-dependency-plan.md
```md
# Package And Dependency Plan

## Runtime
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`: HTTP application runtime
- `@nestjs/config`: typed environment configuration
- `@nestjs/jwt`: access-token signing and verification
- `@nestjs/throttler`: global rate-limiting foundation
- `@nestjs/bullmq`, `bullmq`: async job infrastructure
- `ioredis`: Redis client for ephemeral state and BullMQ connectivity
- `@prisma/client`, `@prisma/adapter-pg`, `pg`: Prisma 7 PostgreSQL access with driver adapter
- `class-validator`, `class-transformer`: DTO validation and transformation
- `bcryptjs`: password hashing
- `libphonenumber-js`: canonical phone normalization
- `helmet`: HTTP hardening
- `dotenv`, `joi`: env loading and validation
- `reflect-metadata`, `rxjs`: Nest runtime requirements

## Development
- `prisma`: schema, generate, and migration CLI
- `typescript`, `ts-node`: TypeScript toolchain
- `@nestjs/cli`, `@nestjs/schematics`: Nest build and local tooling
- `jest`, `ts-jest`, `@types/jest`: unit/integration test runner
- `supertest`, `@types/supertest`: HTTP endpoint testing
- `@nestjs/testing`: Nest testing module support
- `@types/node`, `@types/express`: TypeScript ambient types

## Current implementation slice
- foundation
- config
- common infrastructure
- Prisma/database layer
- auth module
- sessions module

## Deferred to next slice
- users
- profiles
- interests
- discovery
- likes
- matches
- conversations
- messages
- presence
- notifications
- calls
- reports
- blocks
- moderation
- analytics
- feature-flags
- admin
- jobs/workers beyond base queue wiring

```

FILE: src/main.ts
```ts
import "reflect-metadata";
import { bootstrapApplication } from "./bootstrap/app.bootstrap";

void bootstrapApplication();

```

FILE: src/app.module.ts
```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import appConfig from "./config/app.config";
import authConfig from "./config/auth.config";
import bullmqConfig from "./config/bullmq.config";
import databaseConfig from "./config/database.config";
import objectStorageConfig from "./config/object-storage.config";
import redisConfig from "./config/redis.config";
import { validationSchema } from "./config/validation.schema";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AppLogger } from "./common/logger/app-logger.service";
import { PrismaModule } from "./database/prisma/prisma.module";
import { BullmqModule } from "./integrations/bullmq/bullmq.module";
import { RedisModule } from "./integrations/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { SessionsModule } from "./modules/sessions/sessions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        bullmqConfig,
        objectStorageConfig,
      ],
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => [
        {
          ttl: config.defaultThrottleTtlMs,
          limit: config.defaultThrottleLimit,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    BullmqModule,
    SessionsModule,
    AuthModule,
  ],
  providers: [
    AppLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

```

FILE: src/bootstrap/app.bootstrap.ts
```ts
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../app.module";
import { configureHttpServer } from "./http.bootstrap";

export async function bootstrapApplication(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  await configureHttpServer(app);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

```

FILE: src/bootstrap/http.bootstrap.ts
```ts
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { AppLogger } from "../common/logger/app-logger.service";

export async function configureHttpServer(
  app: NestExpressApplication,
): Promise<void> {
  const configService = app.get(ConfigService);
  const logger = app.get(AppLogger);
  const apiPrefix = configService.get<string>("app.apiPrefix", "api/v1");

  app.useLogger(logger);
  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const headerRequestId = req.header("x-request-id");
    const requestId =
      headerRequestId && headerRequestId.trim().length > 0
        ? headerRequestId.trim()
        : randomUUID();

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.enableShutdownHooks();
}

```

FILE: src/config/app.config.ts
```ts
import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  name: process.env.APP_NAME ?? "aroha-backend",
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  defaultThrottleTtlMs: 60_000,
  defaultThrottleLimit: 120,
}));

```

FILE: src/config/auth.config.ts
```ts
import { registerAs } from "@nestjs/config";

export default registerAs("auth", () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "",
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  refreshTokenGraceSeconds: Number(
    process.env.REFRESH_TOKEN_GRACE_SECONDS ?? 30,
  ),
  passwordPepper: process.env.PASSWORD_PEPPER ?? "",
  refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER ?? "",
}));

```

FILE: src/config/database.config.ts
```ts
import { registerAs } from "@nestjs/config";

export default registerAs("database", () => ({
  url: process.env.DATABASE_URL ?? "",
  poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  connectionTimeoutMs: Number(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 5_000,
  ),
  idleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 300_000),
  maxLifetimeSeconds: Number(process.env.DATABASE_MAX_LIFETIME_SECONDS ?? 0),
}));

```

FILE: src/config/redis.config.ts
```ts
import { registerAs } from "@nestjs/config";

export default registerAs("redis", () => ({
  url: process.env.REDIS_URL ?? "redis://localhost:6379/0",
}));

```

FILE: src/config/bullmq.config.ts
```ts
import { registerAs } from "@nestjs/config";

export default registerAs("bullmq", () => ({
  prefix: process.env.BULLMQ_PREFIX ?? "aroha",
}));

```

FILE: src/config/object-storage.config.ts
```ts
import { registerAs } from "@nestjs/config";

export default registerAs("objectStorage", () => ({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? "",
  region: process.env.OBJECT_STORAGE_REGION ?? "auto",
  accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY ?? "",
  secretKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? "",
  forcePathStyle: (process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
  bucketProfilePhotos:
    process.env.OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS ?? "profile-photos",
  bucketMessageAttachments:
    process.env.OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS ??
    "message-attachments",
}));

```

FILE: src/config/validation.schema.ts
```ts
import Joi from "joi";

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default("api/v1"),
  APP_NAME: Joi.string().default("aroha-backend"),
  DATABASE_URL: Joi.string().uri({ scheme: ["postgres", "postgresql"] }).required(),
  SHADOW_DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgres", "postgresql"] })
    .optional(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),
  DATABASE_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(300000),
  DATABASE_MAX_LIFETIME_SECONDS: Joi.number().integer().min(0).default(0),
  REDIS_URL: Joi.string().uri({ scheme: ["redis", "rediss"] }).required(),
  BULLMQ_PREFIX: Joi.string().default("aroha"),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(30),
  REFRESH_TOKEN_GRACE_SECONDS: Joi.number().integer().min(1).default(30),
  PASSWORD_PEPPER: Joi.string().min(32).required(),
  REFRESH_TOKEN_PEPPER: Joi.string().min(32).required(),
  OBJECT_STORAGE_ENDPOINT: Joi.string().uri().required(),
  OBJECT_STORAGE_REGION: Joi.string().required(),
  OBJECT_STORAGE_ACCESS_KEY: Joi.string().required(),
  OBJECT_STORAGE_SECRET_KEY: Joi.string().required(),
  OBJECT_STORAGE_FORCE_PATH_STYLE: Joi.boolean().truthy("true").falsy("false"),
  OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS: Joi.string().required(),
  OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: Joi.string().required(),
});

```

FILE: src/common/constants/error-codes.ts
```ts
export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_CURSOR: "INVALID_CURSOR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  UNAUTHORIZED: "UNAUTHORIZED",
  SESSION_INVALID: "SESSION_INVALID",
  FORBIDDEN: "FORBIDDEN",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONFLICT: "CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  AUTH_IDENTIFIER_REQUIRED: "AUTH_IDENTIFIER_REQUIRED",
  AUTH_IDENTIFIER_TAKEN: "AUTH_IDENTIFIER_TAKEN",
  AUTH_PASSWORD_WEAK: "AUTH_PASSWORD_WEAK",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_REFRESH_INVALID: "AUTH_REFRESH_INVALID",
  AUTH_REFRESH_REPLAY_DETECTED: "AUTH_REFRESH_REPLAY_DETECTED",
  AUTH_ACCOUNT_RESTRICTED: "AUTH_ACCOUNT_RESTRICTED",
  AUTH_ACCOUNT_SUSPENDED: "AUTH_ACCOUNT_SUSPENDED",
  AUTH_ACCOUNT_BANNED: "AUTH_ACCOUNT_BANNED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_NOT_OWNED: "SESSION_NOT_OWNED",
  PUSH_TOKEN_INVALID: "PUSH_TOKEN_INVALID",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  PROFILE_LOCATION_REQUIRED: "PROFILE_LOCATION_REQUIRED",
  PROFILE_AGE_RESTRICTED: "PROFILE_AGE_RESTRICTED",
  PROFILE_COMPLETION_REQUIRED: "PROFILE_COMPLETION_REQUIRED",
  PROFILE_PHOTO_INVALID_TYPE: "PROFILE_PHOTO_INVALID_TYPE",
  PROFILE_PHOTO_TOO_LARGE: "PROFILE_PHOTO_TOO_LARGE",
  PROFILE_PHOTO_NOT_FOUND: "PROFILE_PHOTO_NOT_FOUND",
  PROFILE_PHOTO_NOT_OWNED: "PROFILE_PHOTO_NOT_OWNED",
  PROFILE_PHOTO_PENDING_MODERATION: "PROFILE_PHOTO_PENDING_MODERATION",
  PROFILE_PHOTO_REJECTED: "PROFILE_PHOTO_REJECTED",
  PROFILE_PHOTO_PRIMARY_REQUIRED: "PROFILE_PHOTO_PRIMARY_REQUIRED",
  PROFILE_PHOTO_ORDER_INVALID: "PROFILE_PHOTO_ORDER_INVALID",
  INTEREST_TAG_NOT_FOUND: "INTEREST_TAG_NOT_FOUND",
  INTENT_REQUIRED: "INTENT_REQUIRED",
  DISCOVERY_NOT_AVAILABLE: "DISCOVERY_NOT_AVAILABLE",
  DISCOVERY_PROFILE_INCOMPLETE: "DISCOVERY_PROFILE_INCOMPLETE",
  DISCOVERY_ACCOUNT_RESTRICTED: "DISCOVERY_ACCOUNT_RESTRICTED",
  LIKE_SELF_FORBIDDEN: "LIKE_SELF_FORBIDDEN",
  LIKE_TARGET_NOT_ELIGIBLE: "LIKE_TARGET_NOT_ELIGIBLE",
  LIKE_BLOCKED: "LIKE_BLOCKED",
  LIKE_ALREADY_RETRACTED: "LIKE_ALREADY_RETRACTED",
  PASS_SELF_FORBIDDEN: "PASS_SELF_FORBIDDEN",
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  MATCH_NOT_ACTIVE: "MATCH_NOT_ACTIVE",
  MATCH_COMMUNICATION_FORBIDDEN: "MATCH_COMMUNICATION_FORBIDDEN",
  BLOCK_SELF_FORBIDDEN: "BLOCK_SELF_FORBIDDEN",
  BLOCK_ALREADY_ACTIVE: "BLOCK_ALREADY_ACTIVE",
  CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
  CONVERSATION_NOT_ACCESSIBLE: "CONVERSATION_NOT_ACCESSIBLE",
  CONVERSATION_CLOSED: "CONVERSATION_CLOSED",
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  MESSAGE_NOT_OWNED: "MESSAGE_NOT_OWNED",
  MESSAGE_TEXT_REQUIRED: "MESSAGE_TEXT_REQUIRED",
  MESSAGE_ATTACHMENT_REQUIRED: "MESSAGE_ATTACHMENT_REQUIRED",
  MESSAGE_ATTACHMENT_INVALID_TYPE: "MESSAGE_ATTACHMENT_INVALID_TYPE",
  MESSAGE_ATTACHMENT_TOO_LARGE: "MESSAGE_ATTACHMENT_TOO_LARGE",
  MESSAGE_ATTACHMENT_UPLOAD_INVALID: "MESSAGE_ATTACHMENT_UPLOAD_INVALID",
  MESSAGE_EDIT_WINDOW_EXPIRED: "MESSAGE_EDIT_WINDOW_EXPIRED",
  MESSAGE_ALREADY_DELETED: "MESSAGE_ALREADY_DELETED",
  READ_SEQUENCE_INVALID: "READ_SEQUENCE_INVALID",
  CALL_NOT_FOUND: "CALL_NOT_FOUND",
  CALL_NOT_RINGING: "CALL_NOT_RINGING",
  CALL_NOT_ACTIVE: "CALL_NOT_ACTIVE",
  CALL_PERMISSION_DENIED: "CALL_PERMISSION_DENIED",
  CALL_CONFLICT_ACTIVE_EXISTS: "CALL_CONFLICT_ACTIVE_EXISTS",
  CALL_ALREADY_ACCEPTED: "CALL_ALREADY_ACCEPTED",
  CALL_STALE_SIGNAL: "CALL_STALE_SIGNAL",
  CALL_SIGNAL_INVALID: "CALL_SIGNAL_INVALID",
  REPORT_INVALID_TARGET: "REPORT_INVALID_TARGET",
  REPORT_DUPLICATE: "REPORT_DUPLICATE",
  MODERATION_CASE_NOT_FOUND: "MODERATION_CASE_NOT_FOUND",
  MODERATION_ACTION_INVALID: "MODERATION_ACTION_INVALID",
  ADMIN_ROLE_REQUIRED: "ADMIN_ROLE_REQUIRED",
  FEATURE_FLAG_NOT_FOUND: "FEATURE_FLAG_NOT_FOUND",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

```

FILE: src/common/errors/app.exception.ts
```ts
import { HttpException } from "@nestjs/common";
import type { ErrorCode } from "../constants/error-codes";

export class AppException extends HttpException {
  public readonly code: ErrorCode;

  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code,
        message,
        details: details ?? {},
      },
      status,
    );
    this.code = code;
    this.details = details;
  }
}

```

FILE: src/common/filters/http-exception.filter.ts
```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { ERROR_CODES } from "../constants/error-codes";
import { AppException } from "../errors/app.exception";
import { AppLogger } from "../logger/app-logger.service";
import type { AuthenticatedRequest } from "../types/auth-context.type";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? "unknown";

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: this.readMessage(exception),
          requestId,
          details: exception.details ?? {},
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const details =
        typeof payload === "object" && payload !== null ? payload : {};
      const message = this.readHttpMessage(payload);

      response.status(status).json({
        error: {
          code:
            status === HttpStatus.BAD_REQUEST
              ? ERROR_CODES.VALIDATION_FAILED
              : status === HttpStatus.UNAUTHORIZED
                ? ERROR_CODES.UNAUTHORIZED
                : status === HttpStatus.FORBIDDEN
                  ? ERROR_CODES.FORBIDDEN
                  : status === HttpStatus.NOT_FOUND
                    ? ERROR_CODES.RESOURCE_NOT_FOUND
                    : ERROR_CODES.INTERNAL_ERROR,
          message,
          requestId,
          details,
        },
      });
      return;
    }

    this.logger.error(
      `Unhandled exception for request ${requestId}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: "Unexpected server error",
        requestId,
        details: {},
      },
    });
  }

  private readMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return response;
    }
    if (
      typeof response === "object" &&
      response !== null &&
      "message" in response &&
      typeof response.message === "string"
    ) {
      return response.message;
    }

    return "Request failed";
  }

  private readHttpMessage(payload: string | object): string {
    if (typeof payload === "string") {
      return payload;
    }
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload
    ) {
      const message = payload.message;
      if (Array.isArray(message)) {
        return message.join(", ");
      }
      if (typeof message === "string") {
        return message;
      }
    }

    return "Request failed";
  }
}

```

FILE: src/common/decorators/public.decorator.ts
```ts
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

```

FILE: src/common/decorators/current-user.decorator.ts
```ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "../types/auth-context.type";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext["user"] => {
    const request = context.switchToHttp().getRequest();
    return request.auth.user;
  },
);

```

FILE: src/common/decorators/current-session.decorator.ts
```ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "../types/auth-context.type";

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext["session"] => {
    const request = context.switchToHttp().getRequest();
    return request.auth.session;
  },
);

```

FILE: src/common/dto/cursor-page-query.dto.ts
```ts
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CursorPageQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}

```

FILE: src/common/guards/jwt-auth.guard.ts
```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ERROR_CODES } from "../constants/error-codes";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AppException } from "../errors/app.exception";
import type { AuthenticatedRequest } from "../types/auth-context.type";
import { AuthContextService } from "../../modules/auth/application/auth.services";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authContextService: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Missing bearer token",
      });
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (token.length === 0) {
      throw new AppException(401, ERROR_CODES.UNAUTHORIZED, "Missing bearer token");
    }

    request.auth = await this.authContextService.authenticateAccessToken(token);
    return true;
  }
}

```

FILE: src/common/logger/app-logger.service.ts
```ts
import { ConsoleLogger, Injectable, LogLevel } from "@nestjs/common";

@Injectable()
export class AppLogger extends ConsoleLogger {
  constructor() {
    super("Aroha", {
      logLevels: ["log", "error", "warn", "debug", "verbose"] as LogLevel[],
    });
  }
}

```

FILE: src/common/services/audit-log.service.ts
```ts
import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";

export interface AuditLogInput {
  actorUserId?: string | null;
  actorSessionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

type AuditExecutor = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditLogInput, executor?: AuditExecutor): Promise<void> {
    const db = executor ?? this.prisma;

    await db.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorSessionId: entry.actorSessionId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        targetUserId: entry.targetUserId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ?? {},
      },
    });
  }
}

```

FILE: src/common/services/profile-completion.service.ts
```ts
import { Injectable } from "@nestjs/common";

export const PROFILE_COMPLETION_CRITERIA = [
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

export type ProfileCompletionCriterion =
  (typeof PROFILE_COMPLETION_CRITERIA)[number];

type CoordinateValue = string | number | { toString(): string };

export interface ProfileCompletionEvaluationInput {
  accountIsActive: boolean;
  profileHidden: boolean;
  displayName: string | null;
  bio: string | null;
  dateOfBirth: Date | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  locationLat: CoordinateValue | null;
  locationLng: CoordinateValue | null;
  locationGeohash: string | null;
  activeIntentCount: number;
  approvedPhotoCount: number;
  approvedPrimaryPhotoCount: number;
  discoveryPreference: {
    minAge: number | null;
    maxAge: number | null;
    maxDistanceKm: number | null;
  } | null;
  communicationPreferenceExists: boolean;
  completedAt: Date | null;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  completedAt: Date | null;
  missingCriteria: ProfileCompletionCriterion[];
}

@Injectable()
export class ProfileCompletionService {
  evaluate(input: ProfileCompletionEvaluationInput): ProfileCompletionStatus {
    const missing = new Set<ProfileCompletionCriterion>();

    if (!input.accountIsActive) {
      missing.add("ACCOUNT_NOT_ACTIVE");
    }
    if (input.profileHidden) {
      missing.add("PROFILE_HIDDEN");
    }
    if (!input.displayName || input.displayName.trim().length < 2) {
      missing.add("DISPLAY_NAME");
    }
    if (!input.bio || input.bio.trim().length < 20) {
      missing.add("BIO");
    }
    if (!input.dateOfBirth) {
      missing.add("DATE_OF_BIRTH");
    } else if (calculateAge(input.dateOfBirth) < 18) {
      missing.add("AGE_18_PLUS");
    }
    if (!input.city) {
      missing.add("CITY");
    }
    if (!input.region) {
      missing.add("REGION");
    }
    if (!input.countryCode) {
      missing.add("COUNTRY_CODE");
    }
    if (input.locationLat === null || input.locationLng === null) {
      missing.add("LOCATION_COORDINATES");
    }
    if (!input.locationGeohash) {
      missing.add("LOCATION_GEOHASH");
    }
    if (input.activeIntentCount < 1) {
      missing.add("INTENT");
    }
    if (input.approvedPhotoCount < 1) {
      missing.add("APPROVED_PHOTO");
    }
    if (input.approvedPrimaryPhotoCount < 1) {
      missing.add("APPROVED_PRIMARY_PHOTO");
    }

    const discoveryPreference = input.discoveryPreference;
    if (
      !discoveryPreference ||
      discoveryPreference.minAge === null ||
      discoveryPreference.maxAge === null ||
      discoveryPreference.maxDistanceKm === null ||
      discoveryPreference.minAge < 18 ||
      discoveryPreference.maxAge < discoveryPreference.minAge ||
      discoveryPreference.maxDistanceKm < 1
    ) {
      missing.add("DISCOVERY_PREFERENCE");
    }

    if (!input.communicationPreferenceExists) {
      missing.add("COMMUNICATION_PREFERENCE");
    }

    return {
      isComplete: missing.size === 0,
      completedAt: input.completedAt,
      missingCriteria: Array.from(missing),
    };
  }
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

```

FILE: src/common/types/auth-context.type.ts
```ts
import type { Request } from "express";

export type UserRoleValue = "USER" | "MODERATOR" | "ADMIN";
export type UserStatusValue =
  | "ACTIVE"
  | "RESTRICTED"
  | "SUSPENDED"
  | "BANNED"
  | "DELETED";

export interface JwtAccessPayload {
  sub: string;
  sid: string;
  role: UserRoleValue;
  status: UserStatusValue;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: UserRoleValue;
    status: UserStatusValue;
    isShadowBanned: boolean;
    isDiscoveryFrozen: boolean;
    isChatFrozen: boolean;
    isCallFrozen: boolean;
    lastActiveAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    id: string;
    deviceId: string | null;
    deviceName: string | null;
    platform: string;
    appVersion: string | null;
    lastSeenAt: string | null;
    createdAt: string;
    revokedAt: string | null;
  };
  tokenJti: string;
}

export interface AuthenticatedRequest extends Request {
  requestId?: string;
  auth: AuthContext;
}

```

FILE: src/common/types/express-request.d.ts
```ts
declare namespace Express {
  interface Request {
    requestId?: string;
  }
}

```

FILE: src/common/utils/cursor.util.ts
```ts
import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../constants/error-codes";
import { AppException } from "../errors/app.exception";

export interface DateIdCursor {
  createdAt: string;
  id: string;
}

export function encodeDateIdCursor(cursor: DateIdCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDateIdCursor(cursor: string): DateIdCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<DateIdCursor>;

    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.createdAt.length === 0 ||
      parsed.id.length === 0
    ) {
      throw new Error("Malformed cursor");
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

```

FILE: src/common/utils/crypto.util.ts
```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function hashWithPepper(value: string, pepper: string): string {
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function randomBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

```

FILE: src/common/utils/identifier.util.ts
```ts
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ERROR_CODES } from "../constants/error-codes";
import { AppException } from "../errors/app.exception";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone);

  if (!parsed?.isValid()) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Invalid phone number",
    );
  }

  return parsed.number;
}

export function normalizeIdentifier(identifier: string): {
  type: "email" | "phone";
  value: string;
} {
  const candidate = identifier.trim();

  if (candidate.includes("@")) {
    return {
      type: "email",
      value: normalizeEmail(candidate),
    };
  }

  return {
    type: "phone",
    value: normalizePhone(candidate),
  };
}

```

FILE: src/database/prisma/prisma.transaction.ts
```ts
import type { Prisma, PrismaClient } from "../../generated/prisma/client";

export type PrismaTransactionalClient = Prisma.TransactionClient | PrismaClient;

```

FILE: src/database/prisma/prisma.service.ts
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>("database.url");

    const adapter = new PrismaPg({
      connectionString,
      max: configService.get<number>("database.poolMax", 10),
      connectionTimeoutMillis: configService.get<number>(
        "database.connectionTimeoutMs",
        5_000,
      ),
      idleTimeoutMillis: configService.get<number>(
        "database.idleTimeoutMs",
        300_000,
      ),
      maxLifetimeSeconds: configService.get<number>(
        "database.maxLifetimeSeconds",
        0,
      ),
    });

    super({
      adapter,
      log:
        configService.get<string>("app.nodeEnv") === "development"
          ? ["query", "info", "warn", "error"]
          : ["warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

```

FILE: src/database/prisma/prisma.module.ts
```ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

```

FILE: src/integrations/redis/redis.service.ts
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";

@Injectable()
export class RedisService
  extends IORedis
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    super(configService.getOrThrow<string>("redis.url"), {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.status === "wait" || this.status === "end") {
      await this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}

```

FILE: src/integrations/redis/redis.module.ts
```ts
import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

```

FILE: src/integrations/bullmq/bullmq.producer.ts
```ts
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class BullmqProducer {
  constructor(
    @InjectQueue("default")
    private readonly defaultQueue: Queue,
  ) {}

  async enqueue<TPayload>(
    name: string,
    payload: TPayload,
    opts?: { jobId?: string; delayMs?: number },
  ): Promise<void> {
    await this.defaultQueue.add(name, payload, {
      jobId: opts?.jobId,
      delay: opts?.delayMs,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}

```

FILE: src/integrations/bullmq/bullmq.module.ts
```ts
import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { BullmqProducer } from "./bullmq.producer";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.getOrThrow<string>("redis.url"));

        return {
          prefix: configService.get<string>("bullmq.prefix", "aroha"),
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            db:
              redisUrl.pathname && redisUrl.pathname !== "/"
                ? Number(redisUrl.pathname.slice(1))
                : 0,
            tls: redisUrl.protocol === "rediss:" ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: "default",
    }),
  ],
  providers: [BullmqProducer],
  exports: [BullModule, BullmqProducer],
})
export class BullmqModule {}

```

FILE: src/modules/auth/dto/auth.dto.ts
```ts
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import type { ProfileCompletionCriterion } from "../../../common/services/profile-completion.service";

export const CLIENT_PLATFORM_VALUES = ["IOS", "ANDROID", "WEB", "UNKNOWN"] as const;
export type ClientPlatformValue = (typeof CLIENT_PLATFORM_VALUES)[number];

export class DeviceContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly deviceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly deviceName?: string | null;

  @IsString()
  @IsIn(CLIENT_PLATFORM_VALUES)
  readonly platform!: ClientPlatformValue;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly appVersion?: string | null;
}

export class SignupDto {
  @IsOptional()
  @IsEmail()
  readonly email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly phone?: string | null;

  @IsString()
  readonly password!: string;

  @ValidateNested()
  @Type(() => DeviceContextDto)
  readonly device!: DeviceContextDto;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  readonly identifier!: string;

  @IsString()
  readonly password!: string;

  @ValidateNested()
  @Type(() => DeviceContextDto)
  readonly device!: DeviceContextDto;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  readonly refreshToken!: string;
}

export interface SessionDto {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  platform: ClientPlatformValue;
  appVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export interface TokenPairDto {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  session: SessionDto;
}

export interface CurrentUserDto {
  id: string;
  email: string | null;
  phone: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  status: "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "BANNED" | "DELETED";
  isShadowBanned: boolean;
  isDiscoveryFrozen: boolean;
  isChatFrozen: boolean;
  isCallFrozen: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletionStatusDto {
  isComplete: boolean;
  completedAt: string | null;
  missingCriteria: ProfileCompletionCriterion[];
}

export interface AuthResponseDto {
  tokens: TokenPairDto;
  user: CurrentUserDto;
  profileCompletion: ProfileCompletionStatusDto;
}

export interface RefreshResponseDto {
  tokens: TokenPairDto;
  user: CurrentUserDto;
}

```

FILE: src/modules/auth/domain/auth.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { normalizeEmail, normalizePhone } from "../../../common/utils/identifier.util";
import { PasswordHasherService } from "../infrastructure/auth.infrastructure";

@Injectable()
export class PasswordPolicyService {
  assertValidForSignup(input: {
    password: string;
    email?: string | null;
    phone?: string | null;
  }): void {
    const { password, email, phone } = input;

    if (
      password.length < 10 ||
      password.length > 72 ||
      password.trim().length === 0
    ) {
      throw new AppException(
        400,
        ERROR_CODES.AUTH_PASSWORD_WEAK,
        "Password does not meet policy requirements",
      );
    }

    const normalizedEmail = email ? normalizeEmail(email) : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    if (
      password === normalizedEmail ||
      password === normalizedPhone ||
      password === email ||
      password === phone
    ) {
      throw new AppException(
        400,
        ERROR_CODES.AUTH_PASSWORD_WEAK,
        "Password cannot match email or phone",
      );
    }
  }
}

@Injectable()
export class AuthEligibilityService {
  assertCanAuthenticate(input: {
    status: "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "BANNED" | "DELETED";
    deletedAt: Date | null;
  }): void {
    if (input.deletedAt) {
      throw new AppException(
        403,
        ERROR_CODES.AUTH_ACCOUNT_RESTRICTED,
        "Account is not available",
      );
    }

    switch (input.status) {
      case "ACTIVE":
        return;
      case "RESTRICTED":
        throw new AppException(
          403,
          ERROR_CODES.AUTH_ACCOUNT_RESTRICTED,
          "Account is restricted",
        );
      case "SUSPENDED":
        throw new AppException(
          403,
          ERROR_CODES.AUTH_ACCOUNT_SUSPENDED,
          "Account is suspended",
        );
      case "BANNED":
      case "DELETED":
        throw new AppException(
          403,
          ERROR_CODES.AUTH_ACCOUNT_BANNED,
          "Account is banned",
        );
    }
  }
}

@Injectable()
export class CredentialVerificationService {
  constructor(private readonly passwordHasher: PasswordHasherService) {}

  async verifyOrThrow(password: string, passwordHash: string): Promise<void> {
    const valid = await this.passwordHasher.verify(password, passwordHash);

    if (!valid) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }
  }
}

```

FILE: src/modules/auth/infrastructure/auth.infrastructure.ts
```ts
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import authConfig from "../../../config/auth.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { hashWithPepper, randomBase64Url, safeEqualHex } from "../../../common/utils/crypto.util";
import type {
  Prisma,
  ProfilePhoto,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserProfile,
  UserSession,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { JwtAccessPayload } from "../../../common/types/auth-context.type";

export interface LoginAccountRecord extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
  intents: Pick<UserIntent, "id">[];
  photos: Pick<ProfilePhoto, "id" | "isPrimary">[];
}

export interface SessionAuthContextRecord extends UserSession {
  user: User;
}

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    return hash(password, 12);
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}

@Injectable()
export class OpaqueRefreshTokenService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  issue(sessionId: string): {
    token: string;
    tokenHash: string;
    jti: string;
  } {
    const jti = randomUUID();
    const secret = randomBase64Url(48);
    const token = `${sessionId}.${jti}.${secret}`;

    return {
      token,
      tokenHash: hashWithPepper(token, this.config.refreshTokenPepper),
      jti,
    };
  }

  parseOrThrow(token: string): {
    sessionId: string;
    jti: string;
  } {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    const [sessionId, jti, secret] = parts;
    if (!sessionId || !jti || !secret) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    return { sessionId, jti };
  }

  hash(token: string): string {
    return hashWithPepper(token, this.config.refreshTokenPepper);
  }

  matches(token: string, storedHash: string | null): boolean {
    if (!storedHash) {
      return false;
    }

    return safeEqualHex(this.hash(token), storedHash);
  }
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async issueAccessToken(user: User, sessionId: string): Promise<{
    token: string;
    expiresAt: Date;
    jti: string;
  }> {
    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.config.accessTokenTtlSeconds * 1000,
    );
    const payload: JwtAccessPayload = {
      sub: user.id,
      sid: sessionId,
      role: user.role,
      status: user.status,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.accessTokenTtlSeconds,
    });

    return { token, expiresAt, jti };
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtAccessPayload>(token);
    } catch {
      throw new AppException(
        401,
        ERROR_CODES.UNAUTHORIZED,
        "Invalid access token",
      );
    }
  }
}

@Injectable()
export class AuthUserReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByNormalizedIdentifier(identifier: {
    type: "email" | "phone";
    value: string;
  }): Promise<LoginAccountRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        ...(identifier.type === "email"
          ? { email: identifier.value }
          : { phone: identifier.value }),
      },
      include: {
        profile: true,
        discoveryPreference: true,
        communicationPreference: true,
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
          },
        },
        photos: {
          where: {
            deletedAt: null,
            moderationStatus: "APPROVED",
          },
          select: {
            id: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  async findSessionContextById(
    sessionId: string,
  ): Promise<SessionAuthContextRecord | null> {
    return this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        deletedAt: null,
      },
      include: {
        user: true,
      },
    });
  }
}

@Injectable()
export class AuthSessionWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithBootstrapRecords(
    executor: PrismaTransactionalClient,
    input: {
      email: string | null;
      phone: string | null;
      passwordHash: string;
      lastActiveAt: Date;
    },
  ): Promise<{
    user: User;
    profile: UserProfile;
    discoveryPreference: UserDiscoveryPreference;
    communicationPreference: UserCommunicationPreference;
  }> {
    const user = await executor.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        lastActiveAt: input.lastActiveAt,
      },
    });

    const [profile, discoveryPreference, communicationPreference] =
      await Promise.all([
        executor.userProfile.create({
          data: {
            userId: user.id,
          },
        }),
        executor.userDiscoveryPreference.create({
          data: {
            userId: user.id,
          },
        }),
        executor.userCommunicationPreference.create({
          data: {
            userId: user.id,
          },
        }),
      ]);

    await executor.trustScore.create({
      data: {
        userId: user.id,
      },
    });

    return {
      user,
      profile,
      discoveryPreference,
      communicationPreference,
    };
  }

  async createSession(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      userId: string;
      deviceId: string | null;
      deviceName: string | null;
      platform: "IOS" | "ANDROID" | "WEB" | "UNKNOWN";
      appVersion: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      refreshTokenHash: string;
      refreshTokenJti: string;
      refreshTokenExpiresAt: Date;
      now: Date;
    },
  ): Promise<UserSession> {
    return executor.userSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        platform: input.platform,
        appVersion: input.appVersion,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        currentRefreshTokenHash: input.refreshTokenHash,
        currentRefreshTokenJti: input.refreshTokenJti,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        lastSeenAt: input.now,
      },
    });
  }

  async findReusableSession(
    userId: string,
    deviceId: string | null | undefined,
  ): Promise<UserSession | null> {
    if (!deviceId) {
      return null;
    }

    return this.prisma.userSession.findFirst({
      where: {
        userId,
        deviceId,
        revokedAt: null,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async rotateRefreshToken(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      currentRefreshTokenHash: string;
      currentRefreshTokenJti: string;
      refreshTokenExpiresAt: Date;
      previousRefreshTokenHash: string | null;
      previousRefreshTokenJti: string | null;
      previousRefreshTokenGraceUntil: Date | null;
      deviceName: string | null;
      appVersion: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      now: Date;
    },
  ): Promise<UserSession> {
    return executor.userSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        currentRefreshTokenHash: input.currentRefreshTokenHash,
        currentRefreshTokenJti: input.currentRefreshTokenJti,
        previousRefreshTokenHash: input.previousRefreshTokenHash,
        previousRefreshTokenJti: input.previousRefreshTokenJti,
        previousRefreshTokenGraceUntil: input.previousRefreshTokenGraceUntil,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        deviceName: input.deviceName,
        appVersion: input.appVersion,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        lastSeenAt: input.now,
      },
    });
  }

  async updateUserLastActiveAt(
    executor: PrismaTransactionalClient,
    userId: string,
    lastActiveAt: Date,
  ): Promise<void> {
    await executor.user.update({
      where: { id: userId },
      data: { lastActiveAt },
    });
  }

  async revokeSession(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    await executor.userSession.update({
      where: { id: input.sessionId },
      data: {
        revokedAt: input.now,
        revokedReason: input.reason,
        currentRefreshTokenHash: "",
        previousRefreshTokenHash: null,
        previousRefreshTokenJti: null,
        previousRefreshTokenGraceUntil: null,
      },
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}

```

FILE: src/modules/auth/policies/auth.policies.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { LoginDto, RefreshTokenDto, SignupDto } from "../dto/auth.dto";

@Injectable()
export class LocalCredentialPolicy {
  assertSignupPayload(input: SignupDto): void {
    if (!input.email && !input.phone) {
      throw new AppException(
        400,
        ERROR_CODES.AUTH_IDENTIFIER_REQUIRED,
        "Signup requires email or phone",
      );
    }
  }

  assertLoginPayload(input: LoginDto): void {
    if (!input.identifier || input.identifier.trim().length === 0) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }
  }
}

@Injectable()
export class RefreshTokenPolicy {
  assertPayload(input: RefreshTokenDto): void {
    if (!input.refreshToken || input.refreshToken.trim().length === 0) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }
  }
}

```

FILE: src/modules/auth/events/auth.events.ts
```ts
export const AUTH_EVENTS = {
  USER_REGISTERED: "user.registered",
  SESSION_CREATED: "session.created",
  SESSION_REFRESHED: "session.refreshed",
  SESSION_REVOKED: "session.revoked",
} as const;

```

FILE: src/modules/auth/application/auth.services.ts
```ts
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import authConfig from "../../../config/auth.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  ProfileCompletionService,
  type ProfileCompletionStatus,
} from "../../../common/services/profile-completion.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { normalizeEmail, normalizeIdentifier, normalizePhone } from "../../../common/utils/identifier.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { User, UserSession } from "../../../generated/prisma/client";
import type {
  AuthResponseDto,
  CurrentUserDto,
  DeviceContextDto,
  ProfileCompletionStatusDto,
  RefreshResponseDto,
  SessionDto,
  TokenPairDto,
} from "../dto/auth.dto";
import { AuthEligibilityService, CredentialVerificationService, PasswordPolicyService } from "../domain/auth.domain";
import {
  AuthSessionWriteRepository,
  AuthUserReadRepository,
  JwtTokenService,
  OpaqueRefreshTokenService,
  type LoginAccountRecord,
  PasswordHasherService,
} from "../infrastructure/auth.infrastructure";
import { LocalCredentialPolicy, RefreshTokenPolicy } from "../policies/auth.policies";

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthContextService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly authEligibilityService: AuthEligibilityService,
  ) {}

  async authenticateAccessToken(token: string): Promise<AuthContext> {
    const payload = await this.jwtTokenService.verifyAccessToken(token);
    const sessionContext =
      await this.authUserReadRepository.findSessionContextById(payload.sid);

    if (!sessionContext || sessionContext.revokedAt || sessionContext.deletedAt) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Session is invalid",
      );
    }

    if (sessionContext.user.id !== payload.sub) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Session is invalid",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: sessionContext.user.status,
      deletedAt: sessionContext.user.deletedAt,
    });

    return {
      user: mapCurrentUser(sessionContext.user),
      session: mapSession(sessionContext, true),
      tokenJti: payload.jti,
    };
  }
}

@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localCredentialPolicy: LocalCredentialPolicy,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly tokenService: JwtTokenService,
    private readonly opaqueRefreshTokenService: OpaqueRefreshTokenService,
    private readonly auditLogService: AuditLogService,
    private readonly profileCompletionService: ProfileCompletionService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async execute(
    input: {
      email?: string | null;
      phone?: string | null;
      password: string;
      device: DeviceContextDto;
    },
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    this.localCredentialPolicy.assertSignupPayload(input);
    this.passwordPolicyService.assertValidForSignup({
      password: input.password,
      email: input.email ?? null,
      phone: input.phone ?? null,
    });

    const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
    const normalizedPhone = input.phone ? normalizePhone(input.phone) : null;

    if (normalizedEmail) {
      const existing = await this.authUserReadRepository.findByNormalizedIdentifier(
        {
          type: "email",
          value: normalizedEmail,
        },
      );
      if (existing) {
        throw new AppException(
          409,
          ERROR_CODES.AUTH_IDENTIFIER_TAKEN,
          "Identifier already in use",
        );
      }
    }

    if (normalizedPhone) {
      const existing = await this.authUserReadRepository.findByNormalizedIdentifier(
        {
          type: "phone",
          value: normalizedPhone,
        },
      );
      if (existing) {
        throw new AppException(
          409,
          ERROR_CODES.AUTH_IDENTIFIER_TAKEN,
          "Identifier already in use",
        );
      }
    }

    const passwordHash = await this.passwordHasherService.hash(input.password);
    const sessionId = randomUUID();
    const now = new Date();
    const refreshToken = this.opaqueRefreshTokenService.issue(sessionId);
    const refreshTokenExpiresAt = addDays(now, this.config.refreshTokenTtlDays);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const bootstrap =
          await this.authSessionWriteRepository.createUserWithBootstrapRecords(
            tx,
            {
              email: normalizedEmail,
              phone: normalizedPhone,
              passwordHash,
              lastActiveAt: now,
            },
          );

        const session = await this.authSessionWriteRepository.createSession(tx, {
          sessionId,
          userId: bootstrap.user.id,
          deviceId: input.device.deviceId ?? null,
          deviceName: input.device.deviceName ?? null,
          platform: input.device.platform,
          appVersion: input.device.appVersion ?? null,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          refreshTokenHash: refreshToken.tokenHash,
          refreshTokenJti: refreshToken.jti,
          refreshTokenExpiresAt,
          now,
        });

        await this.auditLogService.write(
          {
            actorUserId: bootstrap.user.id,
            actorSessionId: session.id,
            action: "auth.signup",
            entityType: "User",
            entityId: bootstrap.user.id,
            targetUserId: bootstrap.user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            metadata: {
              sessionId: session.id,
            },
          },
          tx,
        );

        return {
          user: bootstrap.user,
          profileCompletion: this.profileCompletionService.evaluate({
            accountIsActive: bootstrap.user.status === "ACTIVE",
            profileHidden: bootstrap.profile.isHidden,
            displayName: bootstrap.profile.displayName,
            bio: bootstrap.profile.bio,
            dateOfBirth: bootstrap.profile.dateOfBirth,
            city: bootstrap.profile.city,
            region: bootstrap.profile.region,
            countryCode: bootstrap.profile.countryCode,
            locationLat: bootstrap.profile.locationLat,
            locationLng: bootstrap.profile.locationLng,
            locationGeohash: bootstrap.profile.locationGeohash,
            activeIntentCount: 0,
            approvedPhotoCount: 0,
            approvedPrimaryPhotoCount: 0,
            discoveryPreference: {
              minAge: bootstrap.discoveryPreference.minAge,
              maxAge: bootstrap.discoveryPreference.maxAge,
              maxDistanceKm: bootstrap.discoveryPreference.maxDistanceKm,
            },
            communicationPreferenceExists: !!bootstrap.communicationPreference,
            completedAt: bootstrap.profile.completedAt,
          }),
          session,
        };
      });

      const accessToken = await this.tokenService.issueAccessToken(
        result.user,
        result.session.id,
      );

      return {
        tokens: mapTokenPair(
          accessToken,
          refreshToken.token,
          refreshTokenExpiresAt,
          result.session,
          true,
        ),
        user: mapCurrentUser(result.user),
        profileCompletion: mapProfileCompletion(result.profileCompletion),
      };
    } catch (error) {
      if (this.authSessionWriteRepository.isUniqueConstraintError(error)) {
        throw new AppException(
          409,
          ERROR_CODES.AUTH_IDENTIFIER_TAKEN,
          "Identifier already in use",
        );
      }

      throw error;
    }
  }

}

@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localCredentialPolicy: LocalCredentialPolicy,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly authEligibilityService: AuthEligibilityService,
    private readonly credentialVerificationService: CredentialVerificationService,
    private readonly tokenService: JwtTokenService,
    private readonly opaqueRefreshTokenService: OpaqueRefreshTokenService,
    private readonly auditLogService: AuditLogService,
    private readonly profileCompletionService: ProfileCompletionService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async execute(
    input: {
      identifier: string;
      password: string;
      device: DeviceContextDto;
    },
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    this.localCredentialPolicy.assertLoginPayload(input);

    let identifier: { type: "email" | "phone"; value: string };
    try {
      identifier = normalizeIdentifier(input.identifier);
    } catch {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    const account =
      await this.authUserReadRepository.findByNormalizedIdentifier(identifier);
    if (!account) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: account.status,
      deletedAt: account.deletedAt,
    });
    await this.credentialVerificationService.verifyOrThrow(
      input.password,
      account.passwordHash,
    );

    const now = new Date();
    const reusableSession = await this.authSessionWriteRepository.findReusableSession(
      account.id,
      input.device.deviceId,
    );
    const sessionId = reusableSession?.id ?? randomUUID();
    const issuedRefreshToken = this.opaqueRefreshTokenService.issue(sessionId);
    const refreshTokenExpiresAt = addDays(now, this.config.refreshTokenTtlDays);

    const result = await this.prisma.$transaction(async (tx) => {
      const session = reusableSession
        ? await this.authSessionWriteRepository.rotateRefreshToken(tx, {
            sessionId: reusableSession.id,
            currentRefreshTokenHash: issuedRefreshToken.tokenHash,
            currentRefreshTokenJti: issuedRefreshToken.jti,
            previousRefreshTokenHash: reusableSession.currentRefreshTokenHash,
            previousRefreshTokenJti: reusableSession.currentRefreshTokenJti,
            previousRefreshTokenGraceUntil: addSeconds(
              now,
              this.config.refreshTokenGraceSeconds,
            ),
            refreshTokenExpiresAt,
            deviceName: input.device.deviceName ?? null,
            appVersion: input.device.appVersion ?? null,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            now,
          })
        : await this.authSessionWriteRepository.createSession(tx, {
            sessionId,
            userId: account.id,
            deviceId: input.device.deviceId ?? null,
            deviceName: input.device.deviceName ?? null,
            platform: input.device.platform,
            appVersion: input.device.appVersion ?? null,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            refreshTokenHash: issuedRefreshToken.tokenHash,
            refreshTokenJti: issuedRefreshToken.jti,
            refreshTokenExpiresAt,
            now,
          });

      await this.authSessionWriteRepository.updateUserLastActiveAt(
        tx,
        account.id,
        now,
      );

      await this.auditLogService.write(
        {
          actorUserId: account.id,
          actorSessionId: session.id,
          action: reusableSession ? "auth.login.reuse-session" : "auth.login",
          entityType: "UserSession",
          entityId: session.id,
          targetUserId: account.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            reusedSession: !!reusableSession,
          },
        },
        tx,
      );

      return {
        session,
      };
    });

    const accessToken = await this.tokenService.issueAccessToken(
      {
        ...account,
        lastActiveAt: now,
      },
      result.session.id,
    );

    return {
      tokens: mapTokenPair(
        accessToken,
        issuedRefreshToken.token,
        refreshTokenExpiresAt,
        result.session,
        true,
      ),
      user: mapCurrentUser({
        ...account,
        lastActiveAt: now,
      }),
      profileCompletion: mapProfileCompletion(
        evaluateAccountProfileCompletion(this.profileCompletionService, account),
      ),
    };
  }
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokenPolicy: RefreshTokenPolicy,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly authEligibilityService: AuthEligibilityService,
    private readonly opaqueRefreshTokenService: OpaqueRefreshTokenService,
    private readonly tokenService: JwtTokenService,
    private readonly auditLogService: AuditLogService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async execute(
    input: { refreshToken: string },
    metadata: RequestMetadata,
  ): Promise<RefreshResponseDto> {
    this.refreshTokenPolicy.assertPayload(input);

    const parsed = this.opaqueRefreshTokenService.parseOrThrow(input.refreshToken);
    const sessionContext =
      await this.authUserReadRepository.findSessionContextById(parsed.sessionId);

    if (
      !sessionContext ||
      sessionContext.revokedAt ||
      sessionContext.deletedAt ||
      sessionContext.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: sessionContext.user.status,
      deletedAt: sessionContext.user.deletedAt,
    });

    const now = new Date();
    const matchesCurrent =
      parsed.jti === sessionContext.currentRefreshTokenJti &&
      this.opaqueRefreshTokenService.matches(
        input.refreshToken,
        sessionContext.currentRefreshTokenHash,
      );
    const matchesPrevious =
      parsed.jti === sessionContext.previousRefreshTokenJti &&
      this.opaqueRefreshTokenService.matches(
        input.refreshToken,
        sessionContext.previousRefreshTokenHash,
      );

    if (!matchesCurrent && !matchesPrevious) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    if (
      matchesPrevious &&
      (!sessionContext.previousRefreshTokenGraceUntil ||
        sessionContext.previousRefreshTokenGraceUntil.getTime() < now.getTime())
    ) {
      await this.prisma.$transaction(async (tx) => {
        await this.authSessionWriteRepository.revokeSession(tx, {
          sessionId: sessionContext.id,
          reason: "refresh_replay_detected",
          now,
        });
        await this.auditLogService.write(
          {
            actorUserId: sessionContext.user.id,
            actorSessionId: sessionContext.id,
            action: "auth.refresh.replay-detected",
            entityType: "UserSession",
            entityId: sessionContext.id,
            targetUserId: sessionContext.user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
          tx,
        );
      });

      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_REPLAY_DETECTED,
        "Refresh token replay detected",
      );
    }

    const issuedRefreshToken = this.opaqueRefreshTokenService.issue(
      sessionContext.id,
    );
    const refreshTokenExpiresAt = addDays(now, this.config.refreshTokenTtlDays);

    const session = await this.prisma.$transaction(async (tx) => {
      const rotatedSession = await this.authSessionWriteRepository.rotateRefreshToken(
        tx,
        {
          sessionId: sessionContext.id,
          currentRefreshTokenHash: issuedRefreshToken.tokenHash,
          currentRefreshTokenJti: issuedRefreshToken.jti,
          previousRefreshTokenHash: sessionContext.currentRefreshTokenHash,
          previousRefreshTokenJti: sessionContext.currentRefreshTokenJti,
          previousRefreshTokenGraceUntil: addSeconds(
            now,
            this.config.refreshTokenGraceSeconds,
          ),
          refreshTokenExpiresAt,
          deviceName: sessionContext.deviceName,
          appVersion: sessionContext.appVersion,
          ipAddress: metadata.ipAddress ?? sessionContext.ipAddress,
          userAgent: metadata.userAgent ?? sessionContext.userAgent,
          now,
        },
      );

      await this.authSessionWriteRepository.updateUserLastActiveAt(
        tx,
        sessionContext.user.id,
        now,
      );

      await this.auditLogService.write(
        {
          actorUserId: sessionContext.user.id,
          actorSessionId: sessionContext.id,
          action: "auth.refresh",
          entityType: "UserSession",
          entityId: sessionContext.id,
          targetUserId: sessionContext.user.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        tx,
      );

      return rotatedSession;
    });

    const accessToken = await this.tokenService.issueAccessToken(
      {
        ...sessionContext.user,
        lastActiveAt: now,
      },
      session.id,
    );

    return {
      tokens: mapTokenPair(
        accessToken,
        issuedRefreshToken.token,
        refreshTokenExpiresAt,
        session,
        true,
      ),
      user: mapCurrentUser({
        ...sessionContext.user,
        lastActiveAt: now,
      }),
    };
  }
}

@Injectable()
export class LogoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(
    authContext: AuthContext,
    metadata: RequestMetadata,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.authSessionWriteRepository.revokeSession(tx, {
        sessionId: authContext.session.id,
        reason: "logout",
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: authContext.user.id,
          actorSessionId: authContext.session.id,
          action: "auth.logout",
          entityType: "UserSession",
          entityId: authContext.session.id,
          targetUserId: authContext.user.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        tx,
      );
    });
  }
}

function evaluateAccountProfileCompletion(
  profileCompletionService: ProfileCompletionService,
  account: LoginAccountRecord,
): ProfileCompletionStatus {
  return profileCompletionService.evaluate({
    accountIsActive: account.status === "ACTIVE" && account.deletedAt === null,
    profileHidden: account.profile?.isHidden ?? false,
    displayName: account.profile?.displayName ?? null,
    bio: account.profile?.bio ?? null,
    dateOfBirth: account.profile?.dateOfBirth ?? null,
    city: account.profile?.city ?? null,
    region: account.profile?.region ?? null,
    countryCode: account.profile?.countryCode ?? null,
    locationLat: account.profile?.locationLat ?? null,
    locationLng: account.profile?.locationLng ?? null,
    locationGeohash: account.profile?.locationGeohash ?? null,
    activeIntentCount: account.intents.length,
    approvedPhotoCount: account.photos.length,
    approvedPrimaryPhotoCount: account.photos.filter((photo) => photo.isPrimary)
      .length,
    discoveryPreference: account.discoveryPreference
      ? {
          minAge: account.discoveryPreference.minAge,
          maxAge: account.discoveryPreference.maxAge,
          maxDistanceKm: account.discoveryPreference.maxDistanceKm,
        }
      : null,
    communicationPreferenceExists: !!account.communicationPreference,
    completedAt: account.profile?.completedAt ?? null,
  });
}

function mapTokenPair(
  accessToken: { token: string; expiresAt: Date },
  refreshToken: string,
  refreshTokenExpiresAt: Date,
  session: UserSession,
  isCurrent: boolean,
): TokenPairDto {
  return {
    accessToken: accessToken.token,
    accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    session: mapSession(session, isCurrent),
  };
}

function mapSession(session: UserSession, isCurrent: boolean): SessionDto {
  return {
    id: session.id,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    platform: session.platform,
    appVersion: session.appVersion,
    lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    isCurrent,
  };
}

function mapCurrentUser(user: User): CurrentUserDto {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isShadowBanned: user.isShadowBanned,
    isDiscoveryFrozen: user.isDiscoveryFrozen,
    isChatFrozen: user.isChatFrozen,
    isCallFrozen: user.isCallFrozen,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function mapProfileCompletion(
  value: ProfileCompletionStatus,
): ProfileCompletionStatusDto {
  return {
    isComplete: value.isComplete,
    completedAt: value.completedAt?.toISOString() ?? null,
    missingCriteria: value.missingCriteria,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addSeconds(date: Date, seconds: number): Date {
  const next = new Date(date);
  next.setUTCSeconds(next.getUTCSeconds() + seconds);
  return next;
}

```

FILE: src/modules/auth/controllers/auth.controller.ts
```ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  LoginDto,
  RefreshTokenDto,
  SignupDto,
  type AuthResponseDto,
  type RefreshResponseDto,
} from "../dto/auth.dto";
import {
  LoginService,
  LogoutService,
  RefreshTokenService,
  SignupService,
} from "../application/auth.services";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly signupService: SignupService,
    private readonly loginService: LoginService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly logoutService: LogoutService,
  ) {}

  @Public()
  @Post("signup")
  async signup(
    @Body() body: SignupDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.signupService.execute(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.loginService.execute(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<RefreshResponseDto> {
    return this.refreshTokenService.execute(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Req() request: Request,
  ): Promise<void> {
    await this.logoutService.execute(
      {
        user,
        session,
        tokenJti: "",
      },
      {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    );
  }
}

```

FILE: src/modules/auth/auth.module.ts
```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import authConfig from "../../config/auth.config";
import { AuditLogService } from "../../common/services/audit-log.service";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { AuthController } from "./controllers/auth.controller";
import {
  AuthContextService,
  LoginService,
  LogoutService,
  RefreshTokenService,
  SignupService,
} from "./application/auth.services";
import {
  AuthEligibilityService,
  CredentialVerificationService,
  PasswordPolicyService,
} from "./domain/auth.domain";
import {
  AuthSessionWriteRepository,
  AuthUserReadRepository,
  JwtTokenService,
  OpaqueRefreshTokenService,
  PasswordHasherService,
} from "./infrastructure/auth.infrastructure";
import { LocalCredentialPolicy, RefreshTokenPolicy } from "./policies/auth.policies";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        secret: config.jwtAccessSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuditLogService,
    ProfileCompletionService,
    AuthContextService,
    SignupService,
    LoginService,
    RefreshTokenService,
    LogoutService,
    PasswordPolicyService,
    CredentialVerificationService,
    AuthEligibilityService,
    PasswordHasherService,
    OpaqueRefreshTokenService,
    JwtTokenService,
    AuthUserReadRepository,
    AuthSessionWriteRepository,
    LocalCredentialPolicy,
    RefreshTokenPolicy,
  ],
  exports: [AuthContextService, CredentialVerificationService],
})
export class AuthModule {}

```

FILE: src/modules/sessions/dto/sessions.dto.ts
```ts
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CLIENT_PLATFORM_VALUES, type SessionDto } from "../../auth/dto/auth.dto";

export const PUSH_PROVIDER_VALUES = ["APNS", "FCM"] as const;
export type PushProviderValue = (typeof PUSH_PROVIDER_VALUES)[number];

export class PushTokenDto {
  @IsString()
  @MaxLength(512)
  readonly token!: string;

  @IsString()
  @IsIn(CLIENT_PLATFORM_VALUES)
  readonly platform!: (typeof CLIENT_PLATFORM_VALUES)[number];

  @IsString()
  @IsIn(PUSH_PROVIDER_VALUES)
  readonly provider!: PushProviderValue;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly deviceId?: string | null;
}

export interface SessionPageDto {
  items: SessionDto[];
  nextCursor: string | null;
}

export interface RevokeOtherSessionsResponseDto {
  revokedCount: number;
}

export interface PushTokenResponseDto {
  id: string;
  token: string;
  platform: (typeof CLIENT_PLATFORM_VALUES)[number];
  provider: PushProviderValue;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

```

FILE: src/modules/sessions/domain/sessions.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { UserSessionRepository } from "../infrastructure/sessions.infrastructure";

@Injectable()
export class SessionRotationPolicyService {
  constructor(private readonly userSessionRepository: UserSessionRepository) {}

  async findReusableSession(
    userId: string,
    deviceId: string | null | undefined,
  ) {
    if (!deviceId) {
      return null;
    }

    return this.userSessionRepository.findLatestActiveByUserAndDevice(
      userId,
      deviceId,
    );
  }
}

@Injectable()
export class DeviceSessionPolicyService {
  normalizeDeviceId(deviceId?: string | null): string | null {
    const normalized = deviceId?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
  }
}

@Injectable()
export class SessionOwnershipPolicy {
  assertOwned(ownerUserId: string, resourceUserId: string): void {
    if (ownerUserId !== resourceUserId) {
      throw new AppException(
        403,
        ERROR_CODES.SESSION_NOT_OWNED,
        "Session belongs to another user",
      );
    }
  }
}

```

FILE: src/modules/sessions/infrastructure/sessions.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { PushToken, UserSession } from "../../../generated/prisma/client";

@Injectable()
export class UserSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: UserSession[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.userSession.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: new Date(cursor.createdAt),
                  },
                },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeDateIdCursor({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findById(sessionId: string): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({
      where: {
        id: sessionId,
      },
    });
  }

  async findLatestActiveByUserAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<UserSession | null> {
    return this.prisma.userSession.findFirst({
      where: {
        userId,
        deviceId,
        deletedAt: null,
        revokedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async revokeById(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    await executor.userSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        revokedAt: input.now,
        revokedReason: input.reason,
        currentRefreshTokenHash: "",
        previousRefreshTokenHash: null,
        previousRefreshTokenJti: null,
        previousRefreshTokenGraceUntil: null,
      },
    });
  }

  async revokeAllOtherSessions(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      currentSessionId: string;
      now: Date;
    },
  ): Promise<number> {
    const sessions = await executor.userSession.findMany({
      where: {
        userId: input.userId,
        id: {
          not: input.currentSessionId,
        },
        deletedAt: null,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    for (const session of sessions) {
      await executor.userSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: input.now,
          revokedReason: "user_revoked_other_sessions",
          currentRefreshTokenHash: "",
          previousRefreshTokenHash: null,
          previousRefreshTokenJti: null,
          previousRefreshTokenGraceUntil: null,
        },
      });
    }

    return sessions.length;
  }
}

@Injectable()
export class PushTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      sessionId: string;
      token: string;
      platform: "IOS" | "ANDROID" | "WEB" | "UNKNOWN";
      provider: "APNS" | "FCM";
      deviceId: string | null;
      now: Date;
    },
  ): Promise<PushToken> {
    return executor.pushToken.upsert({
      where: {
        token: input.token,
      },
      create: {
        userId: input.userId,
        sessionId: input.sessionId,
        token: input.token,
        platform: input.platform,
        provider: input.provider,
        deviceId: input.deviceId,
        lastSeenAt: input.now,
      },
      update: {
        userId: input.userId,
        sessionId: input.sessionId,
        platform: input.platform,
        provider: input.provider,
        deviceId: input.deviceId,
        lastSeenAt: input.now,
        invalidatedAt: null,
        deletedAt: null,
      },
    });
  }

  async findById(pushTokenId: string): Promise<PushToken | null> {
    return this.prisma.pushToken.findUnique({
      where: {
        id: pushTokenId,
      },
    });
  }

  async invalidateById(
    executor: PrismaTransactionalClient,
    pushTokenId: string,
    now: Date,
  ): Promise<void> {
    await executor.pushToken.update({
      where: {
        id: pushTokenId,
      },
      data: {
        invalidatedAt: now,
        deletedAt: now,
      },
    });
  }
}

```

FILE: src/modules/sessions/application/sessions.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PushToken, UserSession } from "../../../generated/prisma/client";
import type { SessionDto } from "../../auth/dto/auth.dto";
import type {
  PushTokenDto,
  PushTokenResponseDto,
  RevokeOtherSessionsResponseDto,
  SessionPageDto,
} from "../dto/sessions.dto";
import { SessionOwnershipPolicy } from "../domain/sessions.domain";
import {
  PushTokenRepository,
  UserSessionRepository,
} from "../infrastructure/sessions.infrastructure";

export interface SessionActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class ListSessionsService {
  constructor(private readonly userSessionRepository: UserSessionRepository) {}

  async execute(input: {
    userId: string;
    currentSessionId: string;
    cursor?: string;
    limit?: number;
  }): Promise<SessionPageDto> {
    const page = await this.userSessionRepository.listByUser(input.userId, {
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map((session) =>
        mapSessionDto(session, session.id === input.currentSessionId),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class RevokeSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly sessionOwnershipPolicy: SessionOwnershipPolicy,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    targetSessionId: string;
    metadata: SessionActionMetadata;
  }): Promise<void> {
    const session = await this.userSessionRepository.findById(input.targetSessionId);

    if (!session || session.deletedAt) {
      throw new AppException(404, ERROR_CODES.SESSION_NOT_FOUND, "Session not found");
    }

    this.sessionOwnershipPolicy.assertOwned(input.actor.user.id, session.userId);

    await this.prisma.$transaction(async (tx) => {
      await this.userSessionRepository.revokeById(tx, {
        sessionId: session.id,
        reason: "user_revoked_session",
        now: new Date(),
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "session.revoke",
          entityType: "UserSession",
          entityId: session.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });
  }
}

@Injectable()
export class RevokeAllOtherSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    metadata: SessionActionMetadata;
  }): Promise<RevokeOtherSessionsResponseDto> {
    const now = new Date();
    const revokedCount = await this.prisma.$transaction(async (tx) => {
      const count = await this.userSessionRepository.revokeAllOtherSessions(tx, {
        userId: input.actor.user.id,
        currentSessionId: input.actor.session.id,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "session.revoke-others",
          entityType: "User",
          entityId: input.actor.user.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            revokedCount: count,
          },
        },
        tx,
      );

      return count;
    });

    return { revokedCount };
  }
}

@Injectable()
export class RegisterPushTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    payload: PushTokenDto;
    metadata: SessionActionMetadata;
  }): Promise<PushTokenResponseDto> {
    const now = new Date();

    const pushToken = await this.prisma.$transaction(async (tx) => {
      const value = await this.pushTokenRepository.upsert(tx, {
        userId: input.actor.user.id,
        sessionId: input.actor.session.id,
        token: input.payload.token,
        platform: input.payload.platform,
        provider: input.payload.provider,
        deviceId: input.payload.deviceId ?? null,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "push-token.register",
          entityType: "PushToken",
          entityId: value.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return value;
    });

    return mapPushToken(pushToken);
  }
}

@Injectable()
export class InvalidatePushTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    pushTokenId: string;
    metadata: SessionActionMetadata;
  }): Promise<void> {
    const pushToken = await this.pushTokenRepository.findById(input.pushTokenId);

    if (!pushToken || pushToken.deletedAt) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Push token not found");
    }

    if (pushToken.userId !== input.actor.user.id) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Push token not found");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.pushTokenRepository.invalidateById(tx, pushToken.id, now);

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "push-token.invalidate",
          entityType: "PushToken",
          entityId: pushToken.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });
  }
}

function mapSessionDto(session: UserSession, isCurrent: boolean): SessionDto {
  return {
    id: session.id,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    platform: session.platform,
    appVersion: session.appVersion,
    lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    isCurrent,
  };
}

function mapPushToken(pushToken: PushToken): PushTokenResponseDto {
  return {
    id: pushToken.id,
    token: pushToken.token,
    platform: pushToken.platform,
    provider: pushToken.provider,
    deviceId: pushToken.deviceId,
    createdAt: pushToken.createdAt.toISOString(),
    updatedAt: pushToken.updatedAt.toISOString(),
  };
}

```

FILE: src/modules/sessions/policies/sessions.policies.ts
```ts
export { SessionOwnershipPolicy } from "../domain/sessions.domain";

```

FILE: src/modules/sessions/events/session.events.ts
```ts
export const SESSION_EVENTS = {
  SESSION_REVOKED: "session.revoked",
  PUSH_TOKEN_REGISTERED: "push-token.registered",
  PUSH_TOKEN_INVALIDATED: "push-token.invalidated",
} as const;

```

FILE: src/modules/sessions/controllers/sessions.controller.ts
```ts
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import type { RevokeOtherSessionsResponseDto, SessionPageDto } from "../dto/sessions.dto";
import {
  ListSessionsService,
  RevokeAllOtherSessionsService,
  RevokeSessionService,
} from "../application/sessions.services";

@Controller("sessions")
export class SessionsController {
  constructor(
    private readonly listSessionsService: ListSessionsService,
    private readonly revokeSessionService: RevokeSessionService,
    private readonly revokeAllOtherSessionsService: RevokeAllOtherSessionsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Query() query: CursorPageQueryDto,
  ): Promise<SessionPageDto> {
    return this.listSessionsService.execute({
      userId: user.id,
      currentSessionId: session.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":sessionId")
  async revoke(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.revokeSessionService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      targetSessionId: sessionId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete("others")
  async revokeOthers(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Req() request: Request,
  ): Promise<RevokeOtherSessionsResponseDto> {
    return this.revokeAllOtherSessionsService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/sessions/controllers/push-tokens.controller.ts
```ts
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { InvalidatePushTokenService, RegisterPushTokenService } from "../application/sessions.services";
import { PushTokenDto, type PushTokenResponseDto } from "../dto/sessions.dto";

@Controller("push-tokens")
export class PushTokensController {
  constructor(
    private readonly registerPushTokenService: RegisterPushTokenService,
    private readonly invalidatePushTokenService: InvalidatePushTokenService,
  ) {}

  @Post()
  async register(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() body: PushTokenDto,
    @Req() request: Request,
  ): Promise<PushTokenResponseDto> {
    return this.registerPushTokenService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":tokenId")
  async delete(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("tokenId", new ParseUUIDPipe()) tokenId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.invalidatePushTokenService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      pushTokenId: tokenId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/sessions/sessions.module.ts
```ts
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import {
  DeviceSessionPolicyService,
  SessionOwnershipPolicy,
  SessionRotationPolicyService,
} from "./domain/sessions.domain";
import {
  InvalidatePushTokenService,
  ListSessionsService,
  RegisterPushTokenService,
  RevokeAllOtherSessionsService,
  RevokeSessionService,
} from "./application/sessions.services";
import { PushTokensController } from "./controllers/push-tokens.controller";
import { SessionsController } from "./controllers/sessions.controller";
import {
  PushTokenRepository,
  UserSessionRepository,
} from "./infrastructure/sessions.infrastructure";

@Module({
  controllers: [SessionsController, PushTokensController],
  providers: [
    AuditLogService,
    ListSessionsService,
    RevokeSessionService,
    RevokeAllOtherSessionsService,
    RegisterPushTokenService,
    InvalidatePushTokenService,
    SessionRotationPolicyService,
    DeviceSessionPolicyService,
    SessionOwnershipPolicy,
    UserSessionRepository,
    PushTokenRepository,
  ],
  exports: [
    SessionRotationPolicyService,
    DeviceSessionPolicyService,
    UserSessionRepository,
  ],
})
export class SessionsModule {}

```

