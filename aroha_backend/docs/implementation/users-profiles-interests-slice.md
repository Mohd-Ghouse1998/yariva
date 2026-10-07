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
    "@aws-sdk/client-s3": "^3.914.0",
    "@aws-sdk/s3-request-presigner": "^3.914.0",
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
import { ObjectStorageModule } from "./integrations/object-storage/object-storage.module";
import { RedisModule } from "./integrations/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { InterestsModule } from "./modules/interests/interests.module";
import { UsersModule } from "./modules/users/users.module";

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
    ObjectStorageModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    ProfilesModule,
    InterestsModule,
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

export interface PersistedProfileCompletionStateInput {
  previousIsComplete: boolean;
  previousCompletedAt: Date | null;
  evaluated: ProfileCompletionStatus;
  now: Date;
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

export function resolvePersistedProfileCompletionState(
  input: PersistedProfileCompletionStateInput,
): ProfileCompletionStatus {
  const completedAt = input.evaluated.isComplete
    ? input.previousIsComplete
      ? input.previousCompletedAt ?? input.now
      : input.now
    : input.previousCompletedAt;

  return {
    isComplete: input.evaluated.isComplete,
    completedAt,
    missingCriteria: input.evaluated.missingCriteria,
  };
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

FILE: src/common/utils/geohash.util.ts
```ts
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision = 9,
): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let bit = 0;
  let current = 0;
  let isLongitude = true;
  let geohash = "";

  while (geohash.length < precision) {
    if (isLongitude) {
      const midpoint = (lngMin + lngMax) / 2;
      if (longitude >= midpoint) {
        current = (current << 1) + 1;
        lngMin = midpoint;
      } else {
        current <<= 1;
        lngMax = midpoint;
      }
    } else {
      const midpoint = (latMin + latMax) / 2;
      if (latitude >= midpoint) {
        current = (current << 1) + 1;
        latMin = midpoint;
      } else {
        current <<= 1;
        latMax = midpoint;
      }
    }

    isLongitude = !isLongitude;
    bit += 1;

    if (bit === 5) {
      geohash += BASE32[current];
      bit = 0;
      current = 0;
    }
  }

  return geohash;
}

```

FILE: src/integrations/object-storage/object-storage.module.ts
```ts
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ObjectStorageService } from "./object-storage.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}

```

FILE: src/integrations/object-storage/object-storage.service.ts
```ts
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import objectStorageConfig from "../../config/object-storage.config";

export interface PresignedUploadInstruction {
  uploadUrl: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

export interface HeadedObject {
  sizeBytes: number | null;
  mimeType: string | null;
  metadata: Record<string, string>;
}

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;

  constructor(
    @Inject(objectStorageConfig.KEY)
    private readonly config: ConfigType<typeof objectStorageConfig>,
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async createPresignedPutObject(input: {
    bucket: string;
    objectKey: string;
    mimeType: string;
    uploadToken: string;
    userId: string;
    sha256: string | null;
    expiresInSeconds: number;
  }): Promise<PresignedUploadInstruction> {
    const command = new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
      ContentType: input.mimeType,
      Metadata: {
        "aroha-upload-token": input.uploadToken,
        "aroha-user-id": input.userId,
        ...(input.sha256 ? { "aroha-sha256": input.sha256 } : {}),
      },
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);

    return {
      uploadUrl,
      expiresAt,
      headers: {
        "Content-Type": input.mimeType,
        "x-amz-meta-aroha-upload-token": input.uploadToken,
        "x-amz-meta-aroha-user-id": input.userId,
        ...(input.sha256
          ? {
              "x-amz-meta-aroha-sha256": input.sha256,
            }
          : {}),
      },
    };
  }

  async headObject(input: {
    bucket: string;
    objectKey: string;
  }): Promise<HeadedObject> {
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
      }),
    );

    return {
      sizeBytes: result.ContentLength ?? null,
      mimeType: result.ContentType ?? null,
      metadata: result.Metadata ?? {},
    };
  }
}

```

FILE: src/modules/users/dto/users.dto.ts
```ts
import type { CurrentUserDto, ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";

export interface GetMeResponseDto {
  user: CurrentUserDto;
  profileCompletion: ProfileCompletionStatusDto;
}

```

FILE: src/modules/users/domain/users.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { User } from "../../../generated/prisma/client";

@Injectable()
export class UserStatePolicyService {
  assertReadable<TUser extends Pick<User, "deletedAt">>(
    user: TUser | null,
  ): asserts user is TUser {
    if (!user || user.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "User not found",
      );
    }
  }
}

@Injectable()
export class UserEligibilityService {
  assertAccessible<TUser extends Pick<User, "deletedAt">>(
    user: TUser | null,
  ): asserts user is TUser {
    if (!user || user.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "User not found",
      );
    }
  }
}

```

FILE: src/modules/users/policies/users.policies.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";

@Injectable()
export class CurrentUserPolicy {
  assertSelf(actorUserId: string, resourceUserId: string): void {
    if (actorUserId !== resourceUserId) {
      throw new AppException(403, ERROR_CODES.FORBIDDEN, "Forbidden");
    }
  }
}

@Injectable()
export class AdminUserStatePolicy {
  assertPrivileged(actorRole: "USER" | "MODERATOR" | "ADMIN"): void {
    if (actorRole === "USER") {
      throw new AppException(
        403,
        ERROR_CODES.ADMIN_ROLE_REQUIRED,
        "Admin role required",
      );
    }
  }
}

```

FILE: src/modules/users/events/users.events.ts
```ts
export const USER_EVENTS = {
  USER_STATE_CHANGED: "user.state-changed",
} as const;

```

FILE: src/modules/users/infrastructure/users.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type {
  ProfilePhoto,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserProfile,
} from "../../../generated/prisma/client";

export interface UserMeRecord extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
  intents: Pick<UserIntent, "intent">[];
  photos: Pick<ProfilePhoto, "id" | "isPrimary">[];
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });
  }

  async findMeById(userId: string): Promise<UserMeRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
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
            intent: true,
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
}

```

FILE: src/modules/users/application/users.services.ts
```ts
import { Injectable } from "@nestjs/common";
import {
  ProfileCompletionService,
  type ProfileCompletionStatus,
} from "../../../common/services/profile-completion.service";
import type { CurrentUserDto, ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import type { GetMeResponseDto } from "../dto/users.dto";
import type { User } from "../../../generated/prisma/client";
import { UserEligibilityService, UserStatePolicyService } from "../domain/users.domain";
import { UserRepository, type UserMeRecord } from "../infrastructure/users.infrastructure";

@Injectable()
export class UserReaderService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userEligibilityService: UserEligibilityService,
  ) {}

  async getRequiredById(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    this.userEligibilityService.assertAccessible(user);
    return user;
  }
}

@Injectable()
export class GetMeService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userStatePolicyService: UserStatePolicyService,
    private readonly profileCompletionService: ProfileCompletionService,
  ) {}

  async execute(userId: string): Promise<GetMeResponseDto> {
    const user = await this.userRepository.findMeById(userId);
    this.userStatePolicyService.assertReadable(user);

    return {
      user: mapCurrentUser(user),
      profileCompletion: mapProfileCompletion(
        this.profileCompletionService.evaluate({
          accountIsActive: user.status === "ACTIVE" && user.deletedAt === null,
          profileHidden: user.profile?.isHidden ?? false,
          displayName: user.profile?.displayName ?? null,
          bio: user.profile?.bio ?? null,
          dateOfBirth: user.profile?.dateOfBirth ?? null,
          city: user.profile?.city ?? null,
          region: user.profile?.region ?? null,
          countryCode: user.profile?.countryCode ?? null,
          locationLat: user.profile?.locationLat ?? null,
          locationLng: user.profile?.locationLng ?? null,
          locationGeohash: user.profile?.locationGeohash ?? null,
          activeIntentCount: user.intents.length,
          approvedPhotoCount: user.photos.length,
          approvedPrimaryPhotoCount: user.photos.filter((photo) => photo.isPrimary)
            .length,
          discoveryPreference: user.discoveryPreference
            ? {
                minAge: user.discoveryPreference.minAge,
                maxAge: user.discoveryPreference.maxAge,
                maxDistanceKm: user.discoveryPreference.maxDistanceKm,
              }
            : null,
          communicationPreferenceExists: !!user.communicationPreference,
          completedAt: user.profile?.completedAt ?? null,
        }),
      ),
    };
  }
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

```

FILE: src/modules/users/application/users.services.spec.ts
```ts
import { ProfileCompletionService } from "../../../common/services/profile-completion.service";
import { GetMeService } from "./users.services";

describe("GetMeService", () => {
  it("returns the current user and profile completion status", async () => {
    const service = new GetMeService(
      {
        findMeById: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "user@example.com",
          phone: null,
          role: "USER",
          status: "ACTIVE",
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          isChatFrozen: false,
          isCallFrozen: false,
          lastActiveAt: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-02T00:00:00.000Z"),
          deletedAt: null,
          profile: {
            isHidden: false,
            displayName: "Aroha User",
            bio: "short",
            dateOfBirth: new Date("1994-01-01T00:00:00.000Z"),
            city: "Bengaluru",
            region: "Karnataka",
            countryCode: "IN",
            locationLat: { toString: () => "12.9716" },
            locationLng: { toString: () => "77.5946" },
            locationGeohash: "tdr1v9x6e",
            completedAt: null,
          },
          intents: [{ intent: "FRIENDSHIP" }],
          photos: [],
          discoveryPreference: {
            minAge: 24,
            maxAge: 36,
            maxDistanceKm: 50,
          },
          communicationPreference: {
            id: "comm-1",
          },
        }),
      } as any,
      {
        assertReadable: jest.fn(),
      } as any,
      new ProfileCompletionService(),
    );

    const result = await service.execute("user-1");

    expect(result.user.id).toBe("user-1");
    expect(result.profileCompletion.isComplete).toBe(false);
    expect(result.profileCompletion.missingCriteria).toContain("BIO");
    expect(result.profileCompletion.missingCriteria).toContain("APPROVED_PHOTO");
  });
});

```

FILE: src/modules/users/controllers/users.controller.ts
```ts
import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { GetMeService } from "../application/users.services";
import type { GetMeResponseDto } from "../dto/users.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly getMeService: GetMeService) {}

  @Get("me")
  async getMe(
    @CurrentUser() user: AuthContext["user"],
  ): Promise<GetMeResponseDto> {
    return this.getMeService.execute(user.id);
  }
}

```

FILE: src/modules/users/users.module.ts
```ts
import { Module } from "@nestjs/common";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { GetMeService, UserReaderService } from "./application/users.services";
import { UsersController } from "./controllers/users.controller";
import { UserEligibilityService, UserStatePolicyService } from "./domain/users.domain";
import { UserRepository } from "./infrastructure/users.infrastructure";
import { AdminUserStatePolicy, CurrentUserPolicy } from "./policies/users.policies";

@Module({
  controllers: [UsersController],
  providers: [
    ProfileCompletionService,
    GetMeService,
    UserReaderService,
    UserStatePolicyService,
    UserEligibilityService,
    UserRepository,
    CurrentUserPolicy,
    AdminUserStatePolicy,
  ],
  exports: [UserReaderService, UserEligibilityService],
})
export class UsersModule {}

```

FILE: src/modules/profiles/dto/profiles.dto.ts
```ts
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";

export const PROFILE_GENDER_VALUES = [
  "WOMAN",
  "MAN",
  "NON_BINARY",
  "TRANS_WOMAN",
  "TRANS_MAN",
  "AGENDER",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;

export const CONNECTION_INTENT_VALUES = [
  "FRIENDSHIP",
  "COMPANIONSHIP",
  "SHARED_INTERESTS",
  "RELATIONSHIP",
] as const;

export const PHOTO_MODERATION_STATUS_VALUES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const SMOKING_HABIT_VALUES = [
  "NEVER",
  "OCCASIONAL",
  "REGULAR",
  "PREFER_NOT_TO_SAY",
] as const;

export const DRINKING_HABIT_VALUES = [
  "NEVER",
  "OCCASIONAL",
  "SOCIAL",
  "REGULAR",
  "PREFER_NOT_TO_SAY",
] as const;

export const EXERCISE_HABIT_VALUES = [
  "NEVER",
  "OCCASIONAL",
  "WEEKLY",
  "FREQUENT",
] as const;

export const DIET_PREFERENCE_VALUES = [
  "OMNIVORE",
  "VEGETARIAN",
  "VEGAN",
  "PESCATARIAN",
  "HALAL",
  "KOSHER",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;

export const PET_PREFERENCE_VALUES = [
  "HAS_PETS",
  "LIKES_PETS",
  "NO_PETS",
  "ALLERGIC",
  "PREFER_NOT_TO_SAY",
] as const;

export const SLEEP_PATTERN_VALUES = [
  "EARLY_BIRD",
  "FLEXIBLE",
  "NIGHT_OWL",
] as const;

export const SOCIAL_ENERGY_VALUES = [
  "LOW_KEY",
  "BALANCED",
  "OUTGOING",
] as const;

export const PROFILE_PHOTO_MIME_TYPE_VALUES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProfileGenderValue = (typeof PROFILE_GENDER_VALUES)[number];
export type ConnectionIntentValue = (typeof CONNECTION_INTENT_VALUES)[number];
export type PhotoModerationStatusValue =
  (typeof PHOTO_MODERATION_STATUS_VALUES)[number];
export type SmokingHabitValue = (typeof SMOKING_HABIT_VALUES)[number];
export type DrinkingHabitValue = (typeof DRINKING_HABIT_VALUES)[number];
export type ExerciseHabitValue = (typeof EXERCISE_HABIT_VALUES)[number];
export type DietPreferenceValue = (typeof DIET_PREFERENCE_VALUES)[number];
export type PetPreferenceValue = (typeof PET_PREFERENCE_VALUES)[number];
export type SleepPatternValue = (typeof SLEEP_PATTERN_VALUES)[number];
export type SocialEnergyValue = (typeof SOCIAL_ENERGY_VALUES)[number];
export type ProfilePhotoMimeTypeValue =
  (typeof PROFILE_PHOTO_MIME_TYPE_VALUES)[number];

export class ProfileLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly lng!: number;
}

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  readonly headline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  readonly bio?: string | null;

  @IsOptional()
  @IsString()
  readonly dateOfBirth?: string | null;

  @IsOptional()
  @IsIn(PROFILE_GENDER_VALUES)
  readonly gender?: ProfileGenderValue | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly pronouns?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly region?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  readonly countryCode?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileLocationDto)
  readonly location?: ProfileLocationDto;

  @IsOptional()
  @IsBoolean()
  readonly hideAge?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly hideDistance?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly isHidden?: boolean;
}

export class UpdateLifestyleDto {
  @IsOptional()
  @IsIn(SMOKING_HABIT_VALUES)
  readonly smoking?: SmokingHabitValue | null;

  @IsOptional()
  @IsIn(DRINKING_HABIT_VALUES)
  readonly drinking?: DrinkingHabitValue | null;

  @IsOptional()
  @IsIn(EXERCISE_HABIT_VALUES)
  readonly exercise?: ExerciseHabitValue | null;

  @IsOptional()
  @IsIn(DIET_PREFERENCE_VALUES)
  readonly diet?: DietPreferenceValue | null;

  @IsOptional()
  @IsIn(PET_PREFERENCE_VALUES)
  readonly petPreference?: PetPreferenceValue | null;

  @IsOptional()
  @IsIn(SLEEP_PATTERN_VALUES)
  readonly sleepPattern?: SleepPatternValue | null;

  @IsOptional()
  @IsIn(SOCIAL_ENERGY_VALUES)
  readonly socialEnergy?: SocialEnergyValue | null;
}

export class UpdateSchedulePreferenceDto {
  @IsInt()
  @Min(0)
  readonly weekdayMask!: number;

  @IsInt()
  @Min(0)
  readonly timeBlockMask!: number;

  @IsBoolean()
  readonly prefersWeekends!: boolean;

  @IsBoolean()
  readonly remoteFriendly!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly maxMeetupsPerWeek?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly preferredLeadTimeDays?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly timezone?: string | null;
}

export class UpdateDiscoveryPreferenceDto {
  @IsInt()
  @Min(18)
  readonly minAge!: number;

  @IsInt()
  @Min(18)
  readonly maxAge!: number;

  @IsInt()
  @Min(1)
  readonly maxDistanceKm!: number;

  @IsArray()
  @ArrayUnique()
  @IsIn(CONNECTION_INTENT_VALUES, { each: true })
  readonly intentFilter!: ConnectionIntentValue[];

  @IsArray()
  @ArrayUnique()
  @IsIn(PROFILE_GENDER_VALUES, { each: true })
  readonly preferredGenders!: ProfileGenderValue[];

  @IsBoolean()
  readonly includeRecentlyActiveOnly!: boolean;

  @IsBoolean()
  readonly preferSameCity!: boolean;
}

export class UpdateCommunicationPreferenceDto {
  @IsBoolean()
  readonly allowVoiceCalls!: boolean;

  @IsBoolean()
  readonly allowVideoCalls!: boolean;

  @IsBoolean()
  readonly allowPushMatches!: boolean;

  @IsBoolean()
  readonly allowPushMessages!: boolean;

  @IsBoolean()
  readonly allowPushCalls!: boolean;

  @IsBoolean()
  readonly allowReadReceipts!: boolean;
}

export class InitiateProfilePhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly fileName!: string;

  @IsIn(PROFILE_PHOTO_MIME_TYPE_VALUES)
  readonly mimeType!: ProfilePhotoMimeTypeValue;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  readonly sizeBytes!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  readonly sha256?: string | null;
}

export class FinalizeProfilePhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  readonly uploadToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  readonly objectKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly bucket!: string;

  @IsIn(PROFILE_PHOTO_MIME_TYPE_VALUES)
  readonly mimeType!: ProfilePhotoMimeTypeValue;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  readonly sizeBytes!: number;

  @IsInt()
  @Min(1)
  readonly width!: number;

  @IsInt()
  @Min(1)
  readonly height!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  readonly sha256?: string | null;

  @IsInt()
  @Min(0)
  readonly position!: number;
}

export class ReorderProfilePhotosDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  readonly orderedPhotoIds!: string[];
}

export interface InterestTagDto {
  id: string;
  slug: string;
  displayName: string;
  category: string | null;
}

export interface LifestyleDto {
  smoking: SmokingHabitValue | null;
  drinking: DrinkingHabitValue | null;
  exercise: ExerciseHabitValue | null;
  diet: DietPreferenceValue | null;
  petPreference: PetPreferenceValue | null;
  sleepPattern: SleepPatternValue | null;
  socialEnergy: SocialEnergyValue | null;
}

export interface SchedulePreferenceDto {
  weekdayMask: number;
  timeBlockMask: number;
  prefersWeekends: boolean;
  remoteFriendly: boolean;
  maxMeetupsPerWeek: number | null;
  preferredLeadTimeDays: number | null;
  timezone: string | null;
}

export interface DiscoveryPreferenceDto {
  minAge: number | null;
  maxAge: number | null;
  maxDistanceKm: number | null;
  intentFilter: ConnectionIntentValue[];
  preferredGenders: ProfileGenderValue[];
  includeRecentlyActiveOnly: boolean;
  preferSameCity: boolean;
}

export interface CommunicationPreferenceDto {
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  allowPushMatches: boolean;
  allowPushMessages: boolean;
  allowPushCalls: boolean;
  allowReadReceipts: boolean;
}

export interface PrivatePhotoDto {
  id: string;
  objectKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
  moderationStatus: PhotoModerationStatusValue;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyProfileDto {
  userId: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  gender: ProfileGenderValue | null;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  hideAge: boolean;
  hideDistance: boolean;
  isHidden: boolean;
  isComplete: boolean;
  completedAt: string | null;
  photos: PrivatePhotoDto[];
  intents: ConnectionIntentValue[];
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  schedulePreference: SchedulePreferenceDto;
  discoveryPreference: DiscoveryPreferenceDto;
  communicationPreference: CommunicationPreferenceDto;
  completion: ProfileCompletionStatusDto;
  createdAt: string;
  updatedAt: string;
}

export interface MyProfileResponseDto {
  profile: MyProfileDto;
}

export interface InitiateProfilePhotoUploadResponseDto {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface FinalizeProfilePhotoUploadResponseDto {
  photo: PrivatePhotoDto;
  profileCompletion: ProfileCompletionStatusDto;
}

export interface ProfilePhotoResponseDto {
  photo: PrivatePhotoDto;
}

export interface ProfilePhotoListResponseDto {
  photos: PrivatePhotoDto[];
}

export interface PreferenceValueResponseDto<TValue> {
  value: TValue;
}

```

FILE: src/modules/profiles/domain/profiles.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { encodeGeohash } from "../../../common/utils/geohash.util";
import type {
  ProfilePhoto,
  UserProfile,
} from "../../../generated/prisma/client";
import type {
  FinalizeProfilePhotoUploadDto,
  InitiateProfilePhotoUploadDto,
  ReorderProfilePhotosDto,
  UpdateDiscoveryPreferenceDto,
} from "../dto/profiles.dto";

const MAX_PROFILE_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ProfileVisibilityPolicyService {
  assertProfileExists<TProfile extends UserProfile>(
    profile: TProfile | null,
  ): asserts profile is TProfile {
    if (!profile || profile.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.PROFILE_NOT_FOUND,
        "Profile not found",
      );
    }
  }
}

@Injectable()
export class PhotoEligibilityService {
  assertUploadRequestAllowed(input: InitiateProfilePhotoUploadDto): void {
    if (input.sizeBytes > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_PHOTO_TOO_LARGE,
        "Profile photo exceeds maximum size",
      );
    }
  }

  assertFinalizeRequestAllowed(input: FinalizeProfilePhotoUploadDto): void {
    if (input.sizeBytes > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_PHOTO_TOO_LARGE,
        "Profile photo exceeds maximum size",
      );
    }
  }

  assertOrderingMatches(
    currentPhotos: ProfilePhoto[],
    input: ReorderProfilePhotosDto,
  ): void {
    const currentIds = currentPhotos.map((photo) => photo.id).sort();
    const orderedIds = [...input.orderedPhotoIds].sort();

    if (
      currentIds.length !== orderedIds.length ||
      currentIds.some((id, index) => id !== orderedIds[index])
    ) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_PHOTO_ORDER_INVALID,
        "Photo order must contain exactly the current active photos",
      );
    }
  }
}

@Injectable()
export class LocationPrivacyService {
  normalizeCountryCode(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return value.trim().toUpperCase();
  }

  normalizeLocation(
    value: { lat: number; lng: number } | null | undefined,
  ): { lat: number; lng: number; geohash: string } | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (value.lat < -90 || value.lat > 90 || value.lng < -180 || value.lng > 180) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_LOCATION_REQUIRED,
        "Location coordinates are invalid",
      );
    }

    return {
      lat: value.lat,
      lng: value.lng,
      geohash: encodeGeohash(value.lat, value.lng),
    };
  }

  assertAdult(dateOfBirth: Date | null | undefined): void {
    if (!dateOfBirth) {
      return;
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
    const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

    if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
      age -= 1;
    }

    if (age < 18) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_AGE_RESTRICTED,
        "User must be at least 18",
      );
    }
  }
}

@Injectable()
export class DiscoveryPreferencePolicyService {
  assertValid(input: UpdateDiscoveryPreferenceDto): void {
    if (input.maxAge < input.minAge) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Discovery preference age range is invalid",
      );
    }
  }
}

@Injectable()
export class ProfileOwnershipPolicy {
  assertOwned(ownerUserId: string, actorUserId: string): void {
    if (ownerUserId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Forbidden",
      );
    }
  }
}

@Injectable()
export class PhotoOwnershipPolicy {
  assertOwned<TPhoto extends Pick<ProfilePhoto, "userId" | "deletedAt">>(
    photo: TPhoto | null,
    actorUserId: string,
  ): asserts photo is TPhoto {
    if (!photo || photo.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.PROFILE_PHOTO_NOT_FOUND,
        "Profile photo not found",
      );
    }

    if (photo.userId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.PROFILE_PHOTO_NOT_OWNED,
        "Profile photo belongs to another user",
      );
    }
  }
}

```

FILE: src/modules/profiles/policies/profiles.policies.ts
```ts
export {
  DiscoveryPreferencePolicyService,
  PhotoOwnershipPolicy,
  ProfileOwnershipPolicy,
} from "../domain/profiles.domain";

```

FILE: src/modules/profiles/events/profiles.events.ts
```ts
export const PROFILE_EVENTS = {
  PROFILE_UPDATED: "profile.updated",
  PROFILE_COMPLETED: "profile.completed",
  PHOTO_UPLOADED: "photo.uploaded",
  PHOTO_DELETED: "photo.deleted",
  PHOTO_PRIMARY_CHANGED: "photo.primary-changed",
  COMMUNICATION_PREFERENCE_UPDATED: "communication-preference.updated",
} as const;

```

FILE: src/modules/profiles/infrastructure/profiles.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  InterestTag,
  ProfilePhoto,
  Prisma,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserInterest,
  UserLifestyle,
  UserProfile,
  UserSchedulePreference,
} from "../../../generated/prisma/client";

type ProfileExecutor = PrismaService | PrismaTransactionalClient;

export interface ProfileAggregateRecord extends User {
  profile: UserProfile | null;
  photos: ProfilePhoto[];
  intents: Pick<UserIntent, "intent">[];
  interests: (UserInterest & {
    interestTag: InterestTag;
  })[];
  lifestyle: UserLifestyle | null;
  schedulePreference: UserSchedulePreference | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
}

export interface ProfilePhotoUploadIntent {
  userId: string;
  uploadToken: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string | null;
  expiresAt: string;
}

@Injectable()
export class ProfileAggregateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
    executor?: ProfileExecutor,
  ): Promise<ProfileAggregateRecord | null> {
    const db = executor ?? this.prisma;

    return db.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        profile: true,
        photos: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        interests: {
          where: {
            deletedAt: null,
          },
          include: {
            interestTag: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        lifestyle: true,
        schedulePreference: true,
        discoveryPreference: true,
        communicationPreference: true,
      },
    });
  }
}

@Injectable()
export class UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserProfileUpdateInput,
  ): Promise<UserProfile> {
    return executor.userProfile.update({
      where: {
        userId,
      },
      data,
    });
  }

  async updateCompletionState(
    executor: PrismaTransactionalClient,
    userId: string,
    input: {
      isComplete: boolean;
      completedAt: Date | null;
    },
  ): Promise<void> {
    await executor.userProfile.update({
      where: {
        userId,
      },
      data: {
        isComplete: input.isComplete,
        completedAt: input.completedAt,
      },
    });
  }
}

@Injectable()
export class ProfilePhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(photoId: string): Promise<ProfilePhoto | null> {
    return this.prisma.profilePhoto.findFirst({
      where: {
        id: photoId,
        deletedAt: null,
      },
    });
  }

  async findByUserAndObjectKey(
    userId: string,
    objectKey: string,
    executor?: ProfileExecutor,
  ): Promise<ProfilePhoto | null> {
    const db = executor ?? this.prisma;

    return db.profilePhoto.findFirst({
      where: {
        userId,
        objectKey,
        deletedAt: null,
      },
    });
  }

  async listByUser(
    userId: string,
    executor?: ProfileExecutor,
  ): Promise<ProfilePhoto[]> {
    const db = executor ?? this.prisma;

    return db.profilePhoto.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async countByUser(
    userId: string,
    executor?: ProfileExecutor,
  ): Promise<number> {
    const db = executor ?? this.prisma;

    return db.profilePhoto.count({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }

  async shiftPositionsForInsert(
    executor: PrismaTransactionalClient,
    userId: string,
    fromPosition: number,
  ): Promise<void> {
    await executor.profilePhoto.updateMany({
      where: {
        userId,
        deletedAt: null,
        position: {
          gte: fromPosition,
        },
      },
      data: {
        position: {
          increment: 1,
        },
      },
    });
  }

  async shiftPositionsAfterRemoval(
    executor: PrismaTransactionalClient,
    userId: string,
    removedPosition: number,
  ): Promise<void> {
    await executor.profilePhoto.updateMany({
      where: {
        userId,
        deletedAt: null,
        position: {
          gt: removedPosition,
        },
      },
      data: {
        position: {
          decrement: 1,
        },
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      objectKey: string;
      bucket: string;
      mimeType: string;
      sizeBytes: number;
      width: number;
      height: number;
      sha256: string | null;
      position: number;
      isPrimary: boolean;
    },
  ): Promise<ProfilePhoto> {
    return executor.profilePhoto.create({
      data: {
        userId: input.userId,
        objectKey: input.objectKey,
        bucket: input.bucket,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        sha256: input.sha256,
        position: input.position,
        isPrimary: input.isPrimary,
        moderationStatus: "PENDING",
        moderationReason: null,
        reviewedAt: null,
        approvedAt: null,
        rejectedAt: null,
      },
    });
  }

  async updateMetadata(
    executor: PrismaTransactionalClient,
    photoId: string,
    data: Prisma.ProfilePhotoUpdateInput,
  ): Promise<ProfilePhoto> {
    return executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data,
    });
  }

  async clearPrimary(
    executor: PrismaTransactionalClient,
    userId: string,
  ): Promise<void> {
    await executor.profilePhoto.updateMany({
      where: {
        userId,
        deletedAt: null,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  async setPrimary(
    executor: PrismaTransactionalClient,
    photoId: string,
  ): Promise<ProfilePhoto> {
    return executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data: {
        isPrimary: true,
      },
    });
  }

  async reorder(
    executor: PrismaTransactionalClient,
    photoId: string,
    position: number,
  ): Promise<void> {
    await executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data: {
        position,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    photoId: string,
    deletedAt: Date,
  ): Promise<void> {
    await executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data: {
        deletedAt,
        isPrimary: false,
      },
    });
  }

  async findNextPrimaryCandidate(
    userId: string,
    executor: PrismaTransactionalClient,
  ): Promise<ProfilePhoto | null> {
    return executor.profilePhoto.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }
}

@Injectable()
export class UserLifestyleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserLifestyleUncheckedCreateInput,
  ): Promise<UserLifestyle> {
    return executor.userLifestyle.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class UserSchedulePreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserSchedulePreferenceUncheckedCreateInput,
  ): Promise<UserSchedulePreference> {
    return executor.userSchedulePreference.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class UserDiscoveryPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserDiscoveryPreferenceUncheckedCreateInput,
  ): Promise<UserDiscoveryPreference> {
    return executor.userDiscoveryPreference.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class UserCommunicationPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserCommunicationPreferenceUncheckedCreateInput,
  ): Promise<UserCommunicationPreference> {
    return executor.userCommunicationPreference.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class ProfilePhotoUploadStateStore {
  private static readonly KEY_PREFIX = "profile-photo-upload:";

  constructor(private readonly redis: RedisService) {}

  async save(input: ProfilePhotoUploadIntent, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      `${ProfilePhotoUploadStateStore.KEY_PREFIX}${input.uploadToken}`,
      JSON.stringify(input),
      "EX",
      ttlSeconds,
    );
  }

  async get(uploadToken: string): Promise<ProfilePhotoUploadIntent | null> {
    const raw = await this.redis.get(
      `${ProfilePhotoUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as ProfilePhotoUploadIntent;
  }

  async delete(uploadToken: string): Promise<void> {
    await this.redis.del(
      `${ProfilePhotoUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );
  }
}

```

FILE: src/modules/profiles/application/profiles.mappers.ts
```ts
import type { ProfileCompletionStatus } from "../../../common/services/profile-completion.service";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import type {
  ConnectionIntentValue,
  CommunicationPreferenceDto,
  DiscoveryPreferenceDto,
  InterestTagDto,
  LifestyleDto,
  MyProfileDto,
  PrivatePhotoDto,
  SchedulePreferenceDto,
} from "../dto/profiles.dto";
import type { ProfileAggregateRecord } from "../infrastructure/profiles.infrastructure";

export function buildProfileCompletionInput(aggregate: ProfileAggregateRecord) {
  return {
    accountIsActive: aggregate.status === "ACTIVE" && aggregate.deletedAt === null,
    profileHidden: aggregate.profile?.isHidden ?? false,
    displayName: aggregate.profile?.displayName ?? null,
    bio: aggregate.profile?.bio ?? null,
    dateOfBirth: aggregate.profile?.dateOfBirth ?? null,
    city: aggregate.profile?.city ?? null,
    region: aggregate.profile?.region ?? null,
    countryCode: aggregate.profile?.countryCode ?? null,
    locationLat: aggregate.profile?.locationLat ?? null,
    locationLng: aggregate.profile?.locationLng ?? null,
    locationGeohash: aggregate.profile?.locationGeohash ?? null,
    activeIntentCount: aggregate.intents.length,
    approvedPhotoCount: aggregate.photos.filter(
      (photo) =>
        photo.deletedAt === null && photo.moderationStatus === "APPROVED",
    ).length,
    approvedPrimaryPhotoCount: aggregate.photos.filter(
      (photo) =>
        photo.deletedAt === null &&
        photo.moderationStatus === "APPROVED" &&
        photo.isPrimary,
    ).length,
    discoveryPreference: aggregate.discoveryPreference
      ? {
          minAge: aggregate.discoveryPreference.minAge,
          maxAge: aggregate.discoveryPreference.maxAge,
          maxDistanceKm: aggregate.discoveryPreference.maxDistanceKm,
        }
      : null,
    communicationPreferenceExists: !!aggregate.communicationPreference,
    completedAt: aggregate.profile?.completedAt ?? null,
  };
}

export function mapProfileCompletion(
  completion: ProfileCompletionStatus,
): ProfileCompletionStatusDto {
  return {
    isComplete: completion.isComplete,
    completedAt: completion.completedAt?.toISOString() ?? null,
    missingCriteria: completion.missingCriteria,
  };
}

export function mapPrivatePhotoDto(photo: {
  id: string;
  objectKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PrivatePhotoDto {
  return {
    id: photo.id,
    objectKey: photo.objectKey,
    bucket: photo.bucket,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    width: photo.width,
    height: photo.height,
    position: photo.position,
    isPrimary: photo.isPrimary,
    moderationStatus: photo.moderationStatus,
    moderationReason: photo.moderationReason,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
  };
}

export function mapLifestyleDto(aggregate: ProfileAggregateRecord): LifestyleDto {
  return {
    smoking: aggregate.lifestyle?.smoking ?? null,
    drinking: aggregate.lifestyle?.drinking ?? null,
    exercise: aggregate.lifestyle?.exercise ?? null,
    diet: aggregate.lifestyle?.diet ?? null,
    petPreference: aggregate.lifestyle?.petPreference ?? null,
    sleepPattern: aggregate.lifestyle?.sleepPattern ?? null,
    socialEnergy: aggregate.lifestyle?.socialEnergy ?? null,
  };
}

export function mapSchedulePreferenceDto(
  aggregate: ProfileAggregateRecord,
): SchedulePreferenceDto {
  return {
    weekdayMask: aggregate.schedulePreference?.weekdayMask ?? 0,
    timeBlockMask: aggregate.schedulePreference?.timeBlockMask ?? 0,
    prefersWeekends: aggregate.schedulePreference?.prefersWeekends ?? false,
    remoteFriendly: aggregate.schedulePreference?.remoteFriendly ?? false,
    maxMeetupsPerWeek: aggregate.schedulePreference?.maxMeetupsPerWeek ?? null,
    preferredLeadTimeDays:
      aggregate.schedulePreference?.preferredLeadTimeDays ?? null,
    timezone: aggregate.schedulePreference?.timezone ?? null,
  };
}

export function mapDiscoveryPreferenceDto(
  aggregate: ProfileAggregateRecord,
): DiscoveryPreferenceDto {
  return {
    minAge: aggregate.discoveryPreference?.minAge ?? null,
    maxAge: aggregate.discoveryPreference?.maxAge ?? null,
    maxDistanceKm: aggregate.discoveryPreference?.maxDistanceKm ?? null,
    intentFilter:
      (aggregate.discoveryPreference?.intentFilter ??
        []) as ConnectionIntentValue[],
    preferredGenders: aggregate.discoveryPreference?.preferredGenders ?? [],
    includeRecentlyActiveOnly:
      aggregate.discoveryPreference?.includeRecentlyActiveOnly ?? false,
    preferSameCity: aggregate.discoveryPreference?.preferSameCity ?? false,
  };
}

export function mapCommunicationPreferenceDto(
  aggregate: ProfileAggregateRecord,
): CommunicationPreferenceDto {
  return {
    allowVoiceCalls: aggregate.communicationPreference?.allowVoiceCalls ?? true,
    allowVideoCalls: aggregate.communicationPreference?.allowVideoCalls ?? true,
    allowPushMatches: aggregate.communicationPreference?.allowPushMatches ?? true,
    allowPushMessages:
      aggregate.communicationPreference?.allowPushMessages ?? true,
    allowPushCalls: aggregate.communicationPreference?.allowPushCalls ?? true,
    allowReadReceipts:
      aggregate.communicationPreference?.allowReadReceipts ?? true,
  };
}

export function mapInterestTagDto(aggregate: ProfileAggregateRecord): InterestTagDto[] {
  return aggregate.interests.map((userInterest) => ({
    id: userInterest.interestTag.id,
    slug: userInterest.interestTag.slug,
    displayName: userInterest.interestTag.displayName,
    category: userInterest.interestTag.category,
  }));
}

export function mapMyProfileDto(
  aggregate: ProfileAggregateRecord,
  completion: ProfileCompletionStatus,
): MyProfileDto {
  return {
    userId: aggregate.id,
    displayName: aggregate.profile?.displayName ?? null,
    headline: aggregate.profile?.headline ?? null,
    bio: aggregate.profile?.bio ?? null,
    dateOfBirth: aggregate.profile?.dateOfBirth?.toISOString() ?? null,
    gender: aggregate.profile?.gender ?? null,
    pronouns: aggregate.profile?.pronouns ?? null,
    city: aggregate.profile?.city ?? null,
    region: aggregate.profile?.region ?? null,
    countryCode: aggregate.profile?.countryCode ?? null,
    hideAge: aggregate.profile?.hideAge ?? false,
    hideDistance: aggregate.profile?.hideDistance ?? false,
    isHidden: aggregate.profile?.isHidden ?? false,
    isComplete: completion.isComplete,
    completedAt: completion.completedAt?.toISOString() ?? null,
    photos: aggregate.photos.map(mapPrivatePhotoDto),
    intents: aggregate.intents.map((intent) => intent.intent as ConnectionIntentValue),
    interests: mapInterestTagDto(aggregate),
    lifestyle: mapLifestyleDto(aggregate),
    schedulePreference: mapSchedulePreferenceDto(aggregate),
    discoveryPreference: mapDiscoveryPreferenceDto(aggregate),
    communicationPreference: mapCommunicationPreferenceDto(aggregate),
    completion: mapProfileCompletion(completion),
    createdAt: aggregate.profile?.createdAt.toISOString() ?? aggregate.createdAt.toISOString(),
    updatedAt: aggregate.profile?.updatedAt.toISOString() ?? aggregate.updatedAt.toISOString(),
  };
}

```

FILE: src/modules/profiles/application/profiles.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  ProfileCompletionService,
  resolvePersistedProfileCompletionState,
  type ProfileCompletionStatus,
} from "../../../common/services/profile-completion.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import {
  buildProfileCompletionInput,
  mapCommunicationPreferenceDto,
  mapDiscoveryPreferenceDto,
  mapLifestyleDto,
  mapMyProfileDto,
  mapSchedulePreferenceDto,
} from "./profiles.mappers";
import type {
  CommunicationPreferenceDto,
  MyProfileResponseDto,
  PreferenceValueResponseDto,
  SchedulePreferenceDto,
  UpdateCommunicationPreferenceDto,
  UpdateDiscoveryPreferenceDto,
  UpdateLifestyleDto,
  UpdateMyProfileDto,
  UpdateSchedulePreferenceDto,
  DiscoveryPreferenceDto,
  LifestyleDto,
} from "../dto/profiles.dto";
import {
  DiscoveryPreferencePolicyService,
  LocationPrivacyService,
  ProfileVisibilityPolicyService,
} from "../domain/profiles.domain";
import {
  ProfileAggregateRepository,
  UserCommunicationPreferenceRepository,
  UserDiscoveryPreferenceRepository,
  UserLifestyleRepository,
  UserProfileRepository,
  UserSchedulePreferenceRepository,
  type ProfileAggregateRecord,
} from "../infrastructure/profiles.infrastructure";
import { UserReaderService } from "../../users/application/users.services";

export interface ProfileActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class ProfileCompletionSyncService {
  constructor(
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly profileVisibilityPolicyService: ProfileVisibilityPolicyService,
    private readonly profileCompletionService: ProfileCompletionService,
  ) {}

  async recomputeAndPersist(
    userId: string,
    executor: PrismaTransactionalClient,
    now: Date,
  ): Promise<{
    aggregate: ProfileAggregateRecord;
    completion: ProfileCompletionStatus;
  }> {
    const aggregate = await this.profileAggregateRepository.findByUserId(
      userId,
      executor,
    );

    if (!aggregate) {
      throw new Error("User aggregate missing during completion sync");
    }

    this.profileVisibilityPolicyService.assertProfileExists(aggregate.profile);
    const profile = aggregate.profile;

    const evaluated = this.profileCompletionService.evaluate(
      buildProfileCompletionInput(aggregate),
    );
    const resolved = resolvePersistedProfileCompletionState({
      previousIsComplete: profile.isComplete,
      previousCompletedAt: profile.completedAt,
      evaluated,
      now,
    });

    await this.userProfileRepository.updateCompletionState(executor, userId, {
      isComplete: resolved.isComplete,
      completedAt: resolved.completedAt,
    });

    profile.isComplete = resolved.isComplete;
    profile.completedAt = resolved.completedAt;

    return {
      aggregate,
      completion: resolved,
    };
  }
}

@Injectable()
export class GetMyProfileService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly profileVisibilityPolicyService: ProfileVisibilityPolicyService,
    private readonly profileCompletionService: ProfileCompletionService,
  ) {}

  async execute(userId: string): Promise<MyProfileResponseDto> {
    await this.userReaderService.getRequiredById(userId);

    const aggregate = await this.profileAggregateRepository.findByUserId(userId);
    if (!aggregate) {
      throw new Error("User aggregate missing");
    }

    this.profileVisibilityPolicyService.assertProfileExists(aggregate.profile);
    const completion = this.profileCompletionService.evaluate(
      buildProfileCompletionInput(aggregate),
    );

    return {
      profile: mapMyProfileDto(aggregate, completion),
    };
  }
}

@Injectable()
export class UpdateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly locationPrivacyService: LocationPrivacyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateMyProfileDto;
    metadata: ProfileActionMetadata;
  }): Promise<MyProfileResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const parsedDateOfBirth =
      input.payload.dateOfBirth === undefined
        ? undefined
        : input.payload.dateOfBirth === null
          ? null
          : new Date(input.payload.dateOfBirth);

    this.locationPrivacyService.assertAdult(parsedDateOfBirth ?? undefined);
    const normalizedLocation = this.locationPrivacyService.normalizeLocation(
      input.payload.location,
    );
    const normalizedCountryCode = this.locationPrivacyService.normalizeCountryCode(
      input.payload.countryCode,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await this.userProfileRepository.updateProfile(tx, input.userId, {
        ...(input.payload.displayName !== undefined
          ? { displayName: input.payload.displayName }
          : {}),
        ...(input.payload.headline !== undefined
          ? { headline: input.payload.headline }
          : {}),
        ...(input.payload.bio !== undefined ? { bio: input.payload.bio } : {}),
        ...(parsedDateOfBirth !== undefined
          ? { dateOfBirth: parsedDateOfBirth }
          : {}),
        ...(input.payload.gender !== undefined
          ? { gender: input.payload.gender }
          : {}),
        ...(input.payload.pronouns !== undefined
          ? { pronouns: input.payload.pronouns }
          : {}),
        ...(input.payload.city !== undefined ? { city: input.payload.city } : {}),
        ...(input.payload.region !== undefined
          ? { region: input.payload.region }
          : {}),
        ...(normalizedCountryCode !== undefined
          ? { countryCode: normalizedCountryCode }
          : {}),
        ...(normalizedLocation !== undefined
          ? {
              locationLat: normalizedLocation.lat,
              locationLng: normalizedLocation.lng,
              locationGeohash: normalizedLocation.geohash,
              locationUpdatedAt: new Date(),
            }
          : {}),
        ...(input.payload.hideAge !== undefined
          ? { hideAge: input.payload.hideAge }
          : {}),
        ...(input.payload.hideDistance !== undefined
          ? { hideDistance: input.payload.hideDistance }
          : {}),
        ...(input.payload.isHidden !== undefined
          ? { isHidden: input.payload.isHidden }
          : {}),
      });

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.update",
          entityType: "UserProfile",
          entityId: synced.aggregate.profile?.id ?? null,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return synced;
    });

    return {
      profile: mapMyProfileDto(result.aggregate, result.completion),
    };
  }
}

@Injectable()
export class UpdateLifestyleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userLifestyleRepository: UserLifestyleRepository,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateLifestyleDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<LifestyleDto>> {
    await this.userReaderService.getRequiredById(input.userId);

    const aggregate = await this.prisma.$transaction(async (tx) => {
      await this.userLifestyleRepository.upsert(tx, input.userId, {
        userId: input.userId,
        smoking: input.payload.smoking ?? null,
        drinking: input.payload.drinking ?? null,
        exercise: input.payload.exercise ?? null,
        diet: input.payload.diet ?? null,
        petPreference: input.payload.petPreference ?? null,
        sleepPattern: input.payload.sleepPattern ?? null,
        socialEnergy: input.payload.socialEnergy ?? null,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.lifestyle.update",
          entityType: "UserLifestyle",
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      const snapshot = await this.profileAggregateRepository.findByUserId(
        input.userId,
        tx,
      );
      if (!snapshot) {
        throw new Error("User aggregate missing");
      }
      return snapshot;
    });

    return {
      value: mapLifestyleDto(aggregate),
    };
  }
}

@Injectable()
export class UpdateSchedulePreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userSchedulePreferenceRepository: UserSchedulePreferenceRepository,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateSchedulePreferenceDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<SchedulePreferenceDto>> {
    await this.userReaderService.getRequiredById(input.userId);

    const aggregate = await this.prisma.$transaction(async (tx) => {
      await this.userSchedulePreferenceRepository.upsert(tx, input.userId, {
        userId: input.userId,
        weekdayMask: input.payload.weekdayMask,
        timeBlockMask: input.payload.timeBlockMask,
        prefersWeekends: input.payload.prefersWeekends,
        remoteFriendly: input.payload.remoteFriendly,
        maxMeetupsPerWeek: input.payload.maxMeetupsPerWeek ?? null,
        preferredLeadTimeDays: input.payload.preferredLeadTimeDays ?? null,
        timezone: input.payload.timezone ?? null,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.schedule-preference.update",
          entityType: "UserSchedulePreference",
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      const snapshot = await this.profileAggregateRepository.findByUserId(
        input.userId,
        tx,
      );
      if (!snapshot) {
        throw new Error("User aggregate missing");
      }
      return snapshot;
    });

    return {
      value: mapSchedulePreferenceDto(aggregate),
    };
  }
}

@Injectable()
export class UpdateDiscoveryPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userDiscoveryPreferenceRepository: UserDiscoveryPreferenceRepository,
    private readonly discoveryPreferencePolicyService: DiscoveryPreferencePolicyService,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateDiscoveryPreferenceDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<DiscoveryPreferenceDto>> {
    await this.userReaderService.getRequiredById(input.userId);
    this.discoveryPreferencePolicyService.assertValid(input.payload);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.userDiscoveryPreferenceRepository.upsert(tx, input.userId, {
        userId: input.userId,
        minAge: input.payload.minAge,
        maxAge: input.payload.maxAge,
        maxDistanceKm: input.payload.maxDistanceKm,
        intentFilter: input.payload.intentFilter,
        preferredGenders: input.payload.preferredGenders,
        includeRecentlyActiveOnly: input.payload.includeRecentlyActiveOnly,
        preferSameCity: input.payload.preferSameCity,
      });

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.discovery-preference.update",
          entityType: "UserDiscoveryPreference",
          entityId: synced.aggregate.discoveryPreference?.id ?? null,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return synced.aggregate;
    });

    return {
      value: mapDiscoveryPreferenceDto(result),
    };
  }
}

@Injectable()
export class UpdateCommunicationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userCommunicationPreferenceRepository: UserCommunicationPreferenceRepository,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateCommunicationPreferenceDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<CommunicationPreferenceDto>> {
    await this.userReaderService.getRequiredById(input.userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.userCommunicationPreferenceRepository.upsert(tx, input.userId, {
        userId: input.userId,
        allowVoiceCalls: input.payload.allowVoiceCalls,
        allowVideoCalls: input.payload.allowVideoCalls,
        allowPushMatches: input.payload.allowPushMatches,
        allowPushMessages: input.payload.allowPushMessages,
        allowPushCalls: input.payload.allowPushCalls,
        allowReadReceipts: input.payload.allowReadReceipts,
      });

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.communication-preference.update",
          entityType: "UserCommunicationPreference",
          entityId: synced.aggregate.communicationPreference?.id ?? null,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return synced.aggregate;
    });

    return {
      value: mapCommunicationPreferenceDto(result),
    };
  }
}

```

FILE: src/modules/profiles/application/profiles.services.spec.ts
```ts
import { ProfileCompletionService } from "../../../common/services/profile-completion.service";
import { ProfileCompletionSyncService, UpdateProfileService } from "./profiles.services";

describe("ProfileCompletionSyncService", () => {
  it("sets completedAt when a profile transitions to complete", async () => {
    const now = new Date("2026-04-17T10:00:00.000Z");
    const aggregateRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: "user-1",
        status: "ACTIVE",
        deletedAt: null,
        profile: {
          id: "profile-1",
          userId: "user-1",
          displayName: "Aroha User",
          bio: "This is a sufficiently long bio for completion.",
          dateOfBirth: new Date("1995-02-03T00:00:00.000Z"),
          city: "Bengaluru",
          region: "Karnataka",
          countryCode: "IN",
          locationLat: { toString: () => "12.9716" },
          locationLng: { toString: () => "77.5946" },
          locationGeohash: "tdr1v9x6e",
          isHidden: false,
          isComplete: false,
          completedAt: null,
        },
        intents: [{ intent: "FRIENDSHIP" }],
        photos: [
          {
            id: "photo-1",
            isPrimary: true,
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        ],
        discoveryPreference: {
          minAge: 24,
          maxAge: 36,
          maxDistanceKm: 50,
        },
        communicationPreference: {
          id: "comm-1",
        },
      }),
    };
    const userProfileRepository = {
      updateCompletionState: jest.fn().mockResolvedValue(undefined),
    };
    const profileVisibilityPolicyService = {
      assertProfileExists: jest.fn(),
    };
    const service = new ProfileCompletionSyncService(
      aggregateRepository as any,
      userProfileRepository as any,
      profileVisibilityPolicyService as any,
      new ProfileCompletionService(),
    );

    const result = await service.recomputeAndPersist("user-1", {} as any, now);

    expect(userProfileRepository.updateCompletionState).toHaveBeenCalledWith(
      {},
      "user-1",
      {
        isComplete: true,
        completedAt: now,
      },
    );
    expect(result.completion.isComplete).toBe(true);
    expect(result.completion.completedAt).toEqual(now);
  });

  it("preserves previous completedAt when a profile becomes incomplete again", async () => {
    const previousCompletedAt = new Date("2026-04-16T10:00:00.000Z");
    const now = new Date("2026-04-17T10:00:00.000Z");
    const aggregateRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: "user-1",
        status: "ACTIVE",
        deletedAt: null,
        profile: {
          id: "profile-1",
          userId: "user-1",
          displayName: "Aroha User",
          bio: "short",
          dateOfBirth: new Date("1995-02-03T00:00:00.000Z"),
          city: "Bengaluru",
          region: "Karnataka",
          countryCode: "IN",
          locationLat: { toString: () => "12.9716" },
          locationLng: { toString: () => "77.5946" },
          locationGeohash: "tdr1v9x6e",
          isHidden: false,
          isComplete: true,
          completedAt: previousCompletedAt,
        },
        intents: [{ intent: "FRIENDSHIP" }],
        photos: [
          {
            id: "photo-1",
            isPrimary: true,
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        ],
        discoveryPreference: {
          minAge: 24,
          maxAge: 36,
          maxDistanceKm: 50,
        },
        communicationPreference: {
          id: "comm-1",
        },
      }),
    };
    const userProfileRepository = {
      updateCompletionState: jest.fn().mockResolvedValue(undefined),
    };
    const profileVisibilityPolicyService = {
      assertProfileExists: jest.fn(),
    };
    const service = new ProfileCompletionSyncService(
      aggregateRepository as any,
      userProfileRepository as any,
      profileVisibilityPolicyService as any,
      new ProfileCompletionService(),
    );

    const result = await service.recomputeAndPersist("user-1", {} as any, now);

    expect(result.completion.isComplete).toBe(false);
    expect(result.completion.completedAt).toEqual(previousCompletedAt);
  });
});

describe("UpdateProfileService", () => {
  it("updates the profile and returns the recomputed profile payload", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const userProfileRepository = {
      updateProfile: jest.fn().mockResolvedValue(undefined),
    };
    const synced = {
      aggregate: {
        id: "user-1",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
        status: "ACTIVE",
        deletedAt: null,
        profile: {
          id: "profile-1",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-02T00:00:00.000Z"),
          displayName: "Aroha User",
          headline: null,
          bio: "This is a sufficiently long bio for completion.",
          dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
          gender: null,
          pronouns: null,
          city: "Bengaluru",
          region: "Karnataka",
          countryCode: "IN",
          hideAge: false,
          hideDistance: false,
          isHidden: false,
        },
        photos: [],
        intents: [{ intent: "FRIENDSHIP" }],
        interests: [],
        lifestyle: null,
        schedulePreference: null,
        discoveryPreference: {
          minAge: 24,
          maxAge: 36,
          maxDistanceKm: 50,
          intentFilter: [],
          preferredGenders: [],
          includeRecentlyActiveOnly: false,
          preferSameCity: false,
        },
        communicationPreference: {
          allowVoiceCalls: true,
          allowVideoCalls: true,
          allowPushMatches: true,
          allowPushMessages: true,
          allowPushCalls: true,
          allowReadReceipts: true,
        },
      },
      completion: {
        isComplete: false,
        completedAt: null,
        missingCriteria: ["APPROVED_PHOTO", "APPROVED_PRIMARY_PHOTO"],
      },
    };
    const service = new UpdateProfileService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      userProfileRepository as any,
      {
        recomputeAndPersist: jest.fn().mockResolvedValue(synced),
      } as any,
      {
        assertAdult: jest.fn(),
        normalizeLocation: jest.fn().mockReturnValue(undefined),
        normalizeCountryCode: jest.fn().mockReturnValue("IN"),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        displayName: "Aroha User",
        city: "Bengaluru",
        region: "Karnataka",
        countryCode: "in",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(userProfileRepository.updateProfile).toHaveBeenCalledWith(
      tx,
      "user-1",
      expect.objectContaining({
        displayName: "Aroha User",
        city: "Bengaluru",
        region: "Karnataka",
        countryCode: "IN",
      }),
    );
    expect(result.profile.userId).toBe("user-1");
    expect(result.profile.completion.missingCriteria).toContain("APPROVED_PHOTO");
  });
});

```

FILE: src/modules/profiles/application/profile-photos.services.ts
```ts
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import objectStorageConfig from "../../../config/object-storage.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { randomBase64Url } from "../../../common/utils/crypto.util";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { UserReaderService } from "../../users/application/users.services";
import {
  mapPrivatePhotoDto,
  mapProfileCompletion,
} from "./profiles.mappers";
import type {
  FinalizeProfilePhotoUploadDto,
  FinalizeProfilePhotoUploadResponseDto,
  InitiateProfilePhotoUploadDto,
  InitiateProfilePhotoUploadResponseDto,
  ProfilePhotoListResponseDto,
  ProfilePhotoResponseDto,
  ReorderProfilePhotosDto,
} from "../dto/profiles.dto";
import {
  PhotoEligibilityService,
  PhotoOwnershipPolicy,
} from "../domain/profiles.domain";
import {
  ProfilePhotoRepository,
  ProfilePhotoUploadStateStore,
} from "../infrastructure/profiles.infrastructure";
import { ProfileCompletionSyncService, type ProfileActionMetadata } from "./profiles.services";

const PROFILE_PHOTO_UPLOAD_TTL_SECONDS = 15 * 60;
const PROFILE_PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class InitiatePhotoUploadService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly profilePhotoUploadStateStore: ProfilePhotoUploadStateStore,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: InitiateProfilePhotoUploadDto;
  }): Promise<InitiateProfilePhotoUploadResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.photoEligibilityService.assertUploadRequestAllowed(input.payload);

    const uploadToken = randomBase64Url(32);
    const objectKey = buildProfilePhotoObjectKey(
      input.userId,
      input.payload.fileName,
      input.payload.mimeType,
    );
    const instruction = await this.objectStorageService.createPresignedPutObject(
      {
        bucket: this.storageConfig.bucketProfilePhotos,
        objectKey,
        mimeType: input.payload.mimeType,
        uploadToken,
        userId: input.userId,
        sha256: input.payload.sha256 ?? null,
        expiresInSeconds: PROFILE_PHOTO_UPLOAD_TTL_SECONDS,
      },
    );

    await this.profilePhotoUploadStateStore.save(
      {
        userId: input.userId,
        uploadToken,
        bucket: this.storageConfig.bucketProfilePhotos,
        objectKey,
        fileName: input.payload.fileName,
        mimeType: input.payload.mimeType,
        sizeBytes: input.payload.sizeBytes,
        sha256: input.payload.sha256 ?? null,
        expiresAt: instruction.expiresAt.toISOString(),
      },
      PROFILE_PHOTO_UPLOAD_TTL_SECONDS,
    );

    return {
      uploadToken,
      objectKey,
      bucket: this.storageConfig.bucketProfilePhotos,
      method: "PUT",
      uploadUrl: instruction.uploadUrl,
      headers: instruction.headers,
      expiresAt: instruction.expiresAt.toISOString(),
      maxSizeBytes: PROFILE_PHOTO_MAX_SIZE_BYTES,
    };
  }
}

@Injectable()
export class FinalizePhotoUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly profilePhotoUploadStateStore: ProfilePhotoUploadStateStore,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly bullmqProducer: BullmqProducer,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: FinalizeProfilePhotoUploadDto;
    metadata: ProfileActionMetadata;
  }): Promise<FinalizeProfilePhotoUploadResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.photoEligibilityService.assertFinalizeRequestAllowed(input.payload);

    const uploadState = await this.profilePhotoUploadStateStore.get(
      input.payload.uploadToken,
    );

    if (!uploadState) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Profile photo upload is invalid or expired",
      );
    }

    if (input.payload.bucket !== this.storageConfig.bucketProfilePhotos) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Profile photo bucket is invalid",
      );
    }

    assertUploadStateMatches(uploadState, input.userId, input.payload);

    const head = await this.objectStorageService.headObject({
      bucket: input.payload.bucket,
      objectKey: input.payload.objectKey,
    });

    assertHeadedObjectMatches(head, uploadState, input.payload);

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await this.profilePhotoRepository.findByUserAndObjectKey(
        input.userId,
        input.payload.objectKey,
        tx,
      );

      let photo;
      if (existing) {
        photo = await this.profilePhotoRepository.updateMetadata(tx, existing.id, {
          mimeType: input.payload.mimeType,
          sizeBytes: input.payload.sizeBytes,
          width: input.payload.width,
          height: input.payload.height,
          sha256: input.payload.sha256 ?? null,
          moderationStatus: "PENDING",
          moderationReason: null,
          reviewedAt: null,
          approvedAt: null,
          rejectedAt: null,
        });
      } else {
        const currentCount = await this.profilePhotoRepository.countByUser(
          input.userId,
          tx,
        );
        const insertionPosition = Math.min(input.payload.position, currentCount);
        await this.profilePhotoRepository.shiftPositionsForInsert(
          tx,
          input.userId,
          insertionPosition,
        );

        const currentPhotos = await this.profilePhotoRepository.listByUser(
          input.userId,
          tx,
        );
        const hasPrimary = currentPhotos.some((candidate) => candidate.isPrimary);

        photo = await this.profilePhotoRepository.create(tx, {
          userId: input.userId,
          objectKey: input.payload.objectKey,
          bucket: input.payload.bucket,
          mimeType: input.payload.mimeType,
          sizeBytes: input.payload.sizeBytes,
          width: input.payload.width,
          height: input.payload.height,
          sha256: input.payload.sha256 ?? null,
          position: insertionPosition,
          isPrimary: !hasPrimary,
        });
      }

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        now,
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.finalize",
          entityType: "ProfilePhoto",
          entityId: photo.id,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            objectKey: photo.objectKey,
          },
        },
        tx,
      );

      return {
        photo,
        completion: synced.completion,
      };
    });

    await this.profilePhotoUploadStateStore.delete(input.payload.uploadToken);
    await this.enqueuePhotoModeration(result.photo.id, input.userId, result.photo.objectKey, result.photo.mimeType);

    return {
      photo: mapPrivatePhotoDto(result.photo),
      profileCompletion: mapProfileCompletion(result.completion),
    };
  }

  private async enqueuePhotoModeration(
    photoId: string,
    userId: string,
    objectKey: string,
    mimeType: string,
  ): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "photo.moderation",
        {
          photoId,
          userId,
          objectKey,
          mimeType,
        },
        {
          jobId: `photo.moderation:${photoId}`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue photo moderation job for photo ${photoId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

@Injectable()
export class ReorderProfilePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: ReorderProfilePhotosDto;
    metadata: ProfileActionMetadata;
  }): Promise<ProfilePhotoListResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const currentPhotos = await this.profilePhotoRepository.listByUser(input.userId);
    this.photoEligibilityService.assertOrderingMatches(
      currentPhotos,
      input.payload,
    );

    const photos = await this.prisma.$transaction(async (tx) => {
      for (const [index, photoId] of input.payload.orderedPhotoIds.entries()) {
        await this.profilePhotoRepository.reorder(tx, photoId, index);
      }

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.reorder",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return this.profilePhotoRepository.listByUser(input.userId, tx);
    });

    return {
      photos: photos.map(mapPrivatePhotoDto),
    };
  }
}

@Injectable()
export class SetPrimaryPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoOwnershipPolicy: PhotoOwnershipPolicy,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    photoId: string;
    metadata: ProfileActionMetadata;
  }): Promise<ProfilePhotoResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const photo = await this.profilePhotoRepository.findById(input.photoId);
    this.photoOwnershipPolicy.assertOwned(photo, input.userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.profilePhotoRepository.clearPrimary(tx, input.userId);
      const updated = await this.profilePhotoRepository.setPrimary(tx, input.photoId);
      await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.primary.set",
          entityType: "ProfilePhoto",
          entityId: updated.id,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return updated;
    });

    return {
      photo: mapPrivatePhotoDto(result),
    };
  }
}

@Injectable()
export class DeleteProfilePhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoOwnershipPolicy: PhotoOwnershipPolicy,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    photoId: string;
    metadata: ProfileActionMetadata;
  }): Promise<void> {
    await this.userReaderService.getRequiredById(input.userId);

    const photo = await this.profilePhotoRepository.findById(input.photoId);
    this.photoOwnershipPolicy.assertOwned(photo, input.userId);

    await this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      await this.profilePhotoRepository.softDelete(tx, photo.id, deletedAt);
      await this.profilePhotoRepository.shiftPositionsAfterRemoval(
        tx,
        input.userId,
        photo.position,
      );

      if (photo.isPrimary) {
        const next = await this.profilePhotoRepository.findNextPrimaryCandidate(
          input.userId,
          tx,
        );
        if (next) {
          await this.profilePhotoRepository.setPrimary(tx, next.id);
        }
      }

      await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        deletedAt,
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.delete",
          entityType: "ProfilePhoto",
          entityId: photo.id,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });
  }
}

function buildProfilePhotoObjectKey(
  userId: string,
  fileName: string,
  mimeType: string,
): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = resolvePhotoExtension(fileName, mimeType);

  return `${userId}/${year}/${month}/${randomUUID()}${extension}`;
}

function resolvePhotoExtension(fileName: string, mimeType: string): string {
  const extension = extname(fileName.trim()).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg" || extension === ".png" || extension === ".webp") {
    return extension;
  }

  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

function assertUploadStateMatches(
  uploadState: {
    userId: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
  },
  userId: string,
  payload: FinalizeProfilePhotoUploadDto,
): void {
  if (
    uploadState.userId !== userId ||
    uploadState.bucket !== payload.bucket ||
    uploadState.objectKey !== payload.objectKey ||
    uploadState.mimeType !== payload.mimeType ||
    uploadState.sizeBytes !== payload.sizeBytes ||
    (uploadState.sha256 ?? null) !== (payload.sha256 ?? null)
  ) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Profile photo upload does not match the initiated upload",
    );
  }
}

function assertHeadedObjectMatches(
  head: {
    sizeBytes: number | null;
    mimeType: string | null;
    metadata: Record<string, string>;
  },
  uploadState: {
    userId: string;
    uploadToken: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
  },
  payload: FinalizeProfilePhotoUploadDto,
): void {
  if (head.sizeBytes !== payload.sizeBytes || head.mimeType !== payload.mimeType) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Uploaded object metadata does not match the expected file",
    );
  }

  if (
    head.metadata["aroha-user-id"] !== uploadState.userId ||
    head.metadata["aroha-upload-token"] !== uploadState.uploadToken
  ) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Uploaded object ownership metadata is invalid",
    );
  }

  if ((payload.sha256 ?? null) !== (head.metadata["aroha-sha256"] ?? null)) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Uploaded object checksum does not match",
    );
  }
}

```

FILE: src/modules/profiles/application/profile-photos.services.spec.ts
```ts
import { DeleteProfilePhotoService } from "./profile-photos.services";
import { PhotoOwnershipPolicy } from "../domain/profiles.domain";
describe("DeleteProfilePhotoService", () => {
  it("rejects deleting another user's photo", async () => {
    const service = new DeleteProfilePhotoService(
      {
        $transaction: jest.fn(),
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      {
        findById: jest.fn().mockResolvedValue({
          id: "photo-1",
          userId: "user-2",
          deletedAt: null,
        }),
      } as any,
      new PhotoOwnershipPolicy(),
      {} as any,
      {} as any,
    );

    await expect(
      service.execute({
        userId: "user-1",
        photoId: "photo-1",
        metadata: {
          ipAddress: null,
          userAgent: null,
        },
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_PHOTO_NOT_OWNED",
    });
  });
});

```

FILE: src/modules/profiles/controllers/profiles.controller.ts
```ts
import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  GetMyProfileService,
  UpdateCommunicationPreferenceService,
  UpdateDiscoveryPreferenceService,
  UpdateLifestyleService,
  UpdateProfileService,
  UpdateSchedulePreferenceService,
} from "../application/profiles.services";
import type {
  CommunicationPreferenceDto,
  DiscoveryPreferenceDto,
  LifestyleDto,
  MyProfileResponseDto,
  PreferenceValueResponseDto,
  SchedulePreferenceDto,
} from "../dto/profiles.dto";
import {
  UpdateCommunicationPreferenceDto,
  UpdateDiscoveryPreferenceDto,
  UpdateLifestyleDto,
  UpdateMyProfileDto,
  UpdateSchedulePreferenceDto,
} from "../dto/profiles.dto";

@Controller("profiles")
export class ProfilesController {
  constructor(
    private readonly getMyProfileService: GetMyProfileService,
    private readonly updateProfileService: UpdateProfileService,
    private readonly updateLifestyleService: UpdateLifestyleService,
    private readonly updateSchedulePreferenceService: UpdateSchedulePreferenceService,
    private readonly updateDiscoveryPreferenceService: UpdateDiscoveryPreferenceService,
    private readonly updateCommunicationPreferenceService: UpdateCommunicationPreferenceService,
  ) {}

  @Get("me")
  async getMe(
    @CurrentUser() user: AuthContext["user"],
  ): Promise<MyProfileResponseDto> {
    return this.getMyProfileService.execute(user.id);
  }

  @Patch("me")
  async updateMe(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateMyProfileDto,
    @Req() request: Request,
  ): Promise<MyProfileResponseDto> {
    return this.updateProfileService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/lifestyle")
  async updateLifestyle(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateLifestyleDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<LifestyleDto>> {
    return this.updateLifestyleService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/schedule-preference")
  async updateSchedulePreference(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateSchedulePreferenceDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<SchedulePreferenceDto>> {
    return this.updateSchedulePreferenceService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/discovery-preference")
  async updateDiscoveryPreference(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateDiscoveryPreferenceDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<DiscoveryPreferenceDto>> {
    return this.updateDiscoveryPreferenceService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/communication-preference")
  async updateCommunicationPreference(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateCommunicationPreferenceDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<CommunicationPreferenceDto>> {
    return this.updateCommunicationPreferenceService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/profiles/controllers/profile-photos.controller.ts
```ts
import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  DeleteProfilePhotoService,
  FinalizePhotoUploadService,
  InitiatePhotoUploadService,
  ReorderProfilePhotosService,
  SetPrimaryPhotoService,
} from "../application/profile-photos.services";
import {
  FinalizeProfilePhotoUploadDto,
  InitiateProfilePhotoUploadDto,
  ReorderProfilePhotosDto,
  type FinalizeProfilePhotoUploadResponseDto,
  type InitiateProfilePhotoUploadResponseDto,
  type ProfilePhotoListResponseDto,
  type ProfilePhotoResponseDto,
} from "../dto/profiles.dto";

@Controller("profiles/photos")
export class ProfilePhotosController {
  constructor(
    private readonly initiatePhotoUploadService: InitiatePhotoUploadService,
    private readonly finalizePhotoUploadService: FinalizePhotoUploadService,
    private readonly reorderProfilePhotosService: ReorderProfilePhotosService,
    private readonly setPrimaryPhotoService: SetPrimaryPhotoService,
    private readonly deleteProfilePhotoService: DeleteProfilePhotoService,
  ) {}

  @Post("upload")
  async initiateUpload(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: InitiateProfilePhotoUploadDto,
  ): Promise<InitiateProfilePhotoUploadResponseDto> {
    return this.initiatePhotoUploadService.execute({
      userId: user.id,
      payload: body,
    });
  }

  @Post("finalize")
  async finalizeUpload(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: FinalizeProfilePhotoUploadDto,
    @Req() request: Request,
  ): Promise<FinalizeProfilePhotoUploadResponseDto> {
    return this.finalizePhotoUploadService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Patch("order")
  async reorder(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: ReorderProfilePhotosDto,
    @Req() request: Request,
  ): Promise<ProfilePhotoListResponseDto> {
    return this.reorderProfilePhotosService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Patch(":photoId/primary")
  async setPrimary(
    @CurrentUser() user: AuthContext["user"],
    @Param("photoId", new ParseUUIDPipe()) photoId: string,
    @Req() request: Request,
  ): Promise<ProfilePhotoResponseDto> {
    return this.setPrimaryPhotoService.execute({
      userId: user.id,
      photoId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete(":photoId")
  async delete(
    @CurrentUser() user: AuthContext["user"],
    @Param("photoId", new ParseUUIDPipe()) photoId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.deleteProfilePhotoService.execute({
      userId: user.id,
      photoId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/profiles/profiles.module.ts
```ts
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { UsersModule } from "../users/users.module";
import { ProfilePhotosController } from "./controllers/profile-photos.controller";
import { ProfilesController } from "./controllers/profiles.controller";
import {
  DeleteProfilePhotoService,
  FinalizePhotoUploadService,
  InitiatePhotoUploadService,
  ReorderProfilePhotosService,
  SetPrimaryPhotoService,
} from "./application/profile-photos.services";
import {
  GetMyProfileService,
  ProfileCompletionSyncService,
  UpdateCommunicationPreferenceService,
  UpdateDiscoveryPreferenceService,
  UpdateLifestyleService,
  UpdateProfileService,
  UpdateSchedulePreferenceService,
} from "./application/profiles.services";
import {
  DiscoveryPreferencePolicyService,
  LocationPrivacyService,
  PhotoEligibilityService,
  PhotoOwnershipPolicy,
  ProfileOwnershipPolicy,
  ProfileVisibilityPolicyService,
} from "./domain/profiles.domain";
import {
  ProfileAggregateRepository,
  ProfilePhotoRepository,
  ProfilePhotoUploadStateStore,
  UserCommunicationPreferenceRepository,
  UserDiscoveryPreferenceRepository,
  UserLifestyleRepository,
  UserProfileRepository,
  UserSchedulePreferenceRepository,
} from "./infrastructure/profiles.infrastructure";

@Module({
  imports: [UsersModule],
  controllers: [ProfilesController, ProfilePhotosController],
  providers: [
    AuditLogService,
    ProfileCompletionService,
    GetMyProfileService,
    ProfileCompletionSyncService,
    UpdateProfileService,
    UpdateLifestyleService,
    UpdateSchedulePreferenceService,
    UpdateDiscoveryPreferenceService,
    UpdateCommunicationPreferenceService,
    InitiatePhotoUploadService,
    FinalizePhotoUploadService,
    ReorderProfilePhotosService,
    SetPrimaryPhotoService,
    DeleteProfilePhotoService,
    ProfileVisibilityPolicyService,
    PhotoEligibilityService,
    LocationPrivacyService,
    DiscoveryPreferencePolicyService,
    ProfileOwnershipPolicy,
    PhotoOwnershipPolicy,
    ProfileAggregateRepository,
    UserProfileRepository,
    ProfilePhotoRepository,
    UserLifestyleRepository,
    UserSchedulePreferenceRepository,
    UserDiscoveryPreferenceRepository,
    UserCommunicationPreferenceRepository,
    ProfilePhotoUploadStateStore,
  ],
  exports: [ProfileCompletionSyncService, ProfileVisibilityPolicyService],
})
export class ProfilesModule {}

```

FILE: src/modules/interests/dto/interests.dto.ts
```ts
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";

export const CONNECTION_INTENT_VALUES = [
  "FRIENDSHIP",
  "COMPANIONSHIP",
  "SHARED_INTERESTS",
  "RELATIONSHIP",
] as const;

export type ConnectionIntentValue = (typeof CONNECTION_INTENT_VALUES)[number];

export class InterestCatalogQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  readonly limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly search?: string;
}

export class UpdateMyInterestsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  readonly interestTagIds!: string[];
}

export class UpdateMyIntentsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(CONNECTION_INTENT_VALUES, { each: true })
  readonly intents!: ConnectionIntentValue[];
}

export interface InterestTagDto {
  id: string;
  slug: string;
  displayName: string;
  category: string | null;
}

export interface InterestTagPageDto {
  items: InterestTagDto[];
  nextCursor: string | null;
}

export interface UpdateMyInterestsResponseDto {
  interests: InterestTagDto[];
}

export interface UpdateMyIntentsResponseDto {
  intents: ConnectionIntentValue[];
  profileCompletion: ProfileCompletionStatusDto;
}

```

FILE: src/modules/interests/domain/interests.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { InterestTag } from "../../../generated/prisma/client";
import type { ConnectionIntentValue } from "../dto/interests.dto";

@Injectable()
export class InterestValidationService {
  normalizeInterestIds(interestTagIds: string[]): string[] {
    return Array.from(new Set(interestTagIds));
  }

  assertAllActiveTagsExist(
    requestedTagIds: string[],
    tags: InterestTag[],
  ): void {
    if (requestedTagIds.length === 0) {
      return;
    }

    const activeTagIds = new Set(tags.filter((tag) => tag.isActive).map((tag) => tag.id));
    const missing = requestedTagIds.filter((tagId) => !activeTagIds.has(tagId));

    if (missing.length > 0) {
      throw new AppException(
        404,
        ERROR_CODES.INTEREST_TAG_NOT_FOUND,
        "One or more interest tags were not found",
        {
          missingInterestTagIds: missing,
        },
      );
    }
  }
}

@Injectable()
export class IntentCompatibilityService {
  normalizeIntents(intents: ConnectionIntentValue[]): ConnectionIntentValue[] {
    const normalized = Array.from(new Set(intents));

    if (normalized.length === 0) {
      throw new AppException(
        400,
        ERROR_CODES.INTENT_REQUIRED,
        "At least one intent is required",
      );
    }

    return normalized;
  }
}

@Injectable()
export class InterestOwnershipPolicy {
  assertSelf(actorUserId: string, targetUserId: string): void {
    if (actorUserId !== targetUserId) {
      throw new AppException(403, ERROR_CODES.FORBIDDEN, "Forbidden");
    }
  }
}

```

FILE: src/modules/interests/policies/interests.policies.ts
```ts
export { InterestOwnershipPolicy } from "../domain/interests.domain";

```

FILE: src/modules/interests/events/interests.events.ts
```ts
export const INTEREST_EVENTS = {
  USER_INTERESTS_UPDATED: "user.interests-updated",
  USER_INTENTS_UPDATED: "user.intents-updated",
} as const;

```

FILE: src/modules/interests/infrastructure/interests.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  InterestTag,
  ProfilePhoto,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserInterest,
  UserProfile,
} from "../../../generated/prisma/client";

type InterestsExecutor = PrismaService | PrismaTransactionalClient;

export interface InterestCompletionRecord extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
  intents: Pick<UserIntent, "intent">[];
  photos: Pick<ProfilePhoto, "id" | "isPrimary" | "moderationStatus">[];
}

@Injectable()
export class InterestTagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    cursor?: string;
    limit: number;
    search?: string;
  }): Promise<{
    items: InterestTag[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.interestTag.findMany({
      where: {
        isActive: true,
        ...(input.search
          ? {
              OR: [
                {
                  slug: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
                {
                  displayName: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
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

  async findActiveByIds(
    interestTagIds: string[],
    executor?: InterestsExecutor,
  ): Promise<InterestTag[]> {
    const db = executor ?? this.prisma;

    if (interestTagIds.length === 0) {
      return [];
    }

    return db.interestTag.findMany({
      where: {
        id: {
          in: interestTagIds,
        },
        isActive: true,
      },
    });
  }
}

@Injectable()
export class UserInterestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveByUser(
    userId: string,
    executor?: InterestsExecutor,
  ): Promise<(UserInterest & { interestTag: InterestTag })[]> {
    const db = executor ?? this.prisma;

    return db.userInterest.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        interestTag: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async listAllByUser(
    userId: string,
    executor: PrismaTransactionalClient,
  ): Promise<UserInterest[]> {
    return executor.userInterest.findMany({
      where: {
        userId,
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    userId: string,
    interestTagId: string,
  ): Promise<void> {
    await executor.userInterest.create({
      data: {
        userId,
        interestTagId,
      },
    });
  }

  async reactivate(
    executor: PrismaTransactionalClient,
    id: string,
  ): Promise<void> {
    await executor.userInterest.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    id: string,
    deletedAt: Date,
  ): Promise<void> {
    await executor.userInterest.update({
      where: {
        id,
      },
      data: {
        deletedAt,
      },
    });
  }
}

@Injectable()
export class UserIntentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveByUser(
    userId: string,
    executor?: InterestsExecutor,
  ): Promise<Pick<UserIntent, "intent">[]> {
    const db = executor ?? this.prisma;

    return db.userIntent.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        intent: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async listAllByUser(
    userId: string,
    executor: PrismaTransactionalClient,
  ): Promise<UserIntent[]> {
    return executor.userIntent.findMany({
      where: {
        userId,
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    userId: string,
    intent: string,
  ): Promise<void> {
    await executor.userIntent.create({
      data: {
        userId,
        intent: intent as any,
      },
    });
  }

  async reactivate(
    executor: PrismaTransactionalClient,
    id: string,
  ): Promise<void> {
    await executor.userIntent.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    id: string,
    deletedAt: Date,
  ): Promise<void> {
    await executor.userIntent.update({
      where: {
        id,
      },
      data: {
        deletedAt,
      },
    });
  }
}

@Injectable()
export class InterestProfileCompletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
    executor?: InterestsExecutor,
  ): Promise<InterestCompletionRecord | null> {
    const db = executor ?? this.prisma;

    return db.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
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
            intent: true,
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
            moderationStatus: true,
          },
        },
      },
    });
  }

  async updateCompletionState(
    executor: PrismaTransactionalClient,
    userId: string,
    input: {
      isComplete: boolean;
      completedAt: Date | null;
    },
  ): Promise<void> {
    await executor.userProfile.update({
      where: {
        userId,
      },
      data: {
        isComplete: input.isComplete,
        completedAt: input.completedAt,
      },
    });
  }
}

```

FILE: src/modules/interests/application/interests.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  ProfileCompletionService,
  resolvePersistedProfileCompletionState,
} from "../../../common/services/profile-completion.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import { UserReaderService } from "../../users/application/users.services";
import type {
  InterestTagDto,
  InterestTagPageDto,
  UpdateMyInterestsDto,
  UpdateMyInterestsResponseDto,
  UpdateMyIntentsDto,
  UpdateMyIntentsResponseDto,
} from "../dto/interests.dto";
import {
  IntentCompatibilityService,
  InterestValidationService,
} from "../domain/interests.domain";
import {
  InterestProfileCompletionRepository,
  InterestTagRepository,
  UserInterestRepository,
  UserIntentRepository,
} from "../infrastructure/interests.infrastructure";

export interface InterestActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class InterestCatalogService {
  constructor(private readonly interestTagRepository: InterestTagRepository) {}

  async list(input: {
    cursor?: string;
    limit?: number;
    search?: string;
  }): Promise<InterestTagPageDto> {
    const page = await this.interestTagRepository.list({
      cursor: input.cursor,
      limit: input.limit ?? 50,
      search: input.search?.trim() || undefined,
    });

    return {
      items: page.items.map(mapInterestTagDto),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class UserIntentReaderService {
  constructor(private readonly userIntentRepository: UserIntentRepository) {}

  async listActiveByUser(userId: string): Promise<string[]> {
    const intents = await this.userIntentRepository.listActiveByUser(userId);
    return intents.map((intent) => intent.intent);
  }
}

@Injectable()
export class ListInterestTagsService {
  constructor(private readonly interestCatalogService: InterestCatalogService) {}

  async execute(input: {
    cursor?: string;
    limit?: number;
    search?: string;
  }): Promise<InterestTagPageDto> {
    return this.interestCatalogService.list(input);
  }
}

@Injectable()
export class UpdateUserInterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly interestValidationService: InterestValidationService,
    private readonly interestTagRepository: InterestTagRepository,
    private readonly userInterestRepository: UserInterestRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateMyInterestsDto;
    metadata: InterestActionMetadata;
  }): Promise<UpdateMyInterestsResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const requestedTagIds = this.interestValidationService.normalizeInterestIds(
      input.payload.interestTagIds,
    );
    const tags = await this.interestTagRepository.findActiveByIds(requestedTagIds);
    this.interestValidationService.assertAllActiveTagsExist(requestedTagIds, tags);

    const interests = await this.prisma.$transaction(async (tx) => {
      const existing = await this.userInterestRepository.listAllByUser(
        input.userId,
        tx,
      );
      const desired = new Set(requestedTagIds);
      const now = new Date();

      for (const row of existing) {
        const wantsActive = desired.has(row.interestTagId);

        if (wantsActive && row.deletedAt) {
          await this.userInterestRepository.reactivate(tx, row.id);
        } else if (!wantsActive && !row.deletedAt) {
          await this.userInterestRepository.softDelete(tx, row.id, now);
        }
      }

      const existingByTagId = new Set(existing.map((row) => row.interestTagId));
      for (const interestTagId of requestedTagIds) {
        if (!existingByTagId.has(interestTagId)) {
          await this.userInterestRepository.create(tx, input.userId, interestTagId);
        }
      }

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "user.interests.update",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            interestTagIds: requestedTagIds,
          },
        },
        tx,
      );

      return this.userInterestRepository.listActiveByUser(input.userId, tx);
    });

    return {
      interests: interests.map((interest) => mapInterestTagDto(interest.interestTag)),
    };
  }
}

@Injectable()
export class UpdateUserIntentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly intentCompatibilityService: IntentCompatibilityService,
    private readonly userIntentRepository: UserIntentRepository,
    private readonly interestProfileCompletionRepository: InterestProfileCompletionRepository,
    private readonly profileCompletionService: ProfileCompletionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateMyIntentsDto;
    metadata: InterestActionMetadata;
  }): Promise<UpdateMyIntentsResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    const intents = this.intentCompatibilityService.normalizeIntents(
      input.payload.intents,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await this.userIntentRepository.listAllByUser(input.userId, tx);
      const desired = new Set(intents);
      const now = new Date();

      for (const row of existing) {
        const wantsActive = desired.has(row.intent as (typeof intents)[number]);

        if (wantsActive && row.deletedAt) {
          await this.userIntentRepository.reactivate(tx, row.id);
        } else if (!wantsActive && !row.deletedAt) {
          await this.userIntentRepository.softDelete(tx, row.id, now);
        }
      }

      const existingIntents = new Set(existing.map((row) => row.intent));
      for (const intent of intents) {
        if (!existingIntents.has(intent)) {
          await this.userIntentRepository.create(tx, input.userId, intent);
        }
      }

      const snapshot = await this.interestProfileCompletionRepository.findByUserId(
        input.userId,
        tx,
      );

      if (!snapshot?.profile) {
        throw new Error("Profile aggregate missing during intent update");
      }

      const evaluated = this.profileCompletionService.evaluate({
        accountIsActive: snapshot.status === "ACTIVE" && snapshot.deletedAt === null,
        profileHidden: snapshot.profile.isHidden,
        displayName: snapshot.profile.displayName,
        bio: snapshot.profile.bio,
        dateOfBirth: snapshot.profile.dateOfBirth,
        city: snapshot.profile.city,
        region: snapshot.profile.region,
        countryCode: snapshot.profile.countryCode,
        locationLat: snapshot.profile.locationLat,
        locationLng: snapshot.profile.locationLng,
        locationGeohash: snapshot.profile.locationGeohash,
        activeIntentCount: snapshot.intents.length,
        approvedPhotoCount: snapshot.photos.length,
        approvedPrimaryPhotoCount: snapshot.photos.filter((photo) => photo.isPrimary)
          .length,
        discoveryPreference: snapshot.discoveryPreference
          ? {
              minAge: snapshot.discoveryPreference.minAge,
              maxAge: snapshot.discoveryPreference.maxAge,
              maxDistanceKm: snapshot.discoveryPreference.maxDistanceKm,
            }
          : null,
        communicationPreferenceExists: !!snapshot.communicationPreference,
        completedAt: snapshot.profile.completedAt,
      });
      const resolved = resolvePersistedProfileCompletionState({
        previousIsComplete: snapshot.profile.isComplete,
        previousCompletedAt: snapshot.profile.completedAt,
        evaluated,
        now,
      });

      await this.interestProfileCompletionRepository.updateCompletionState(
        tx,
        input.userId,
        {
          isComplete: resolved.isComplete,
          completedAt: resolved.completedAt,
        },
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "user.intents.update",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            intents,
          },
        },
        tx,
      );

      return {
        intents,
        profileCompletion: {
          isComplete: resolved.isComplete,
          completedAt: resolved.completedAt?.toISOString() ?? null,
          missingCriteria: resolved.missingCriteria,
        } satisfies ProfileCompletionStatusDto,
      };
    });

    return result;
  }
}

function mapInterestTagDto(tag: {
  id: string;
  slug: string;
  displayName: string;
  category: string | null;
}): InterestTagDto {
  return {
    id: tag.id,
    slug: tag.slug,
    displayName: tag.displayName,
    category: tag.category,
  };
}

```

FILE: src/modules/interests/application/interests.services.spec.ts
```ts
import { ProfileCompletionService } from "../../../common/services/profile-completion.service";
import {
  UpdateUserInterestsService,
  UpdateUserIntentsService,
} from "./interests.services";
import {
  IntentCompatibilityService,
  InterestValidationService,
} from "../domain/interests.domain";

describe("Interests services", () => {
  it("replaces user interests transactionally", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const userInterestRepository = {
      listAllByUser: jest.fn().mockResolvedValue([
        {
          id: "row-1",
          interestTagId: "tag-1",
          deletedAt: null,
        },
        {
          id: "row-2",
          interestTagId: "tag-2",
          deletedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ]),
      softDelete: jest.fn().mockResolvedValue(undefined),
      reactivate: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
      listActiveByUser: jest.fn().mockResolvedValue([
        {
          id: "row-2",
          interestTag: {
            id: "tag-2",
            slug: "music",
            displayName: "Music",
            category: "arts",
          },
        },
        {
          id: "row-3",
          interestTag: {
            id: "tag-3",
            slug: "hiking",
            displayName: "Hiking",
            category: "outdoors",
          },
        },
      ]),
    };
    const service = new UpdateUserInterestsService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      new InterestValidationService(),
      {
        findActiveByIds: jest.fn().mockResolvedValue([
          {
            id: "tag-2",
            isActive: true,
          },
          {
            id: "tag-3",
            isActive: true,
          },
        ]),
      } as any,
      userInterestRepository as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        interestTagIds: ["tag-2", "tag-3"],
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(userInterestRepository.softDelete).toHaveBeenCalled();
    expect(userInterestRepository.reactivate).toHaveBeenCalledWith(tx, "row-2");
    expect(userInterestRepository.create).toHaveBeenCalledWith(
      tx,
      "user-1",
      "tag-3",
    );
    expect(result.interests).toHaveLength(2);
  });

  it("updates intents and recomputes profile completion", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const updateCompletionState = jest.fn().mockResolvedValue(undefined);
    const service = new UpdateUserIntentsService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      new IntentCompatibilityService(),
      {
        listAllByUser: jest.fn().mockResolvedValue([
          {
            id: "intent-row-1",
            intent: "FRIENDSHIP",
            deletedAt: null,
          },
        ]),
        softDelete: jest.fn().mockResolvedValue(undefined),
        reactivate: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        findByUserId: jest.fn().mockResolvedValue({
          id: "user-1",
          status: "ACTIVE",
          deletedAt: null,
          profile: {
            id: "profile-1",
            isHidden: false,
            displayName: "Aroha User",
            bio: "This is a sufficiently long bio for completion.",
            dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
            city: "Bengaluru",
            region: "Karnataka",
            countryCode: "IN",
            locationLat: { toString: () => "12.9716" },
            locationLng: { toString: () => "77.5946" },
            locationGeohash: "tdr1v9x6e",
            isComplete: false,
            completedAt: null,
          },
          intents: [{ intent: "RELATIONSHIP" }],
          photos: [
            {
              id: "photo-1",
              isPrimary: true,
              moderationStatus: "APPROVED",
            },
          ],
          discoveryPreference: {
            minAge: 24,
            maxAge: 36,
            maxDistanceKm: 50,
          },
          communicationPreference: {
            id: "comm-1",
          },
        }),
        updateCompletionState,
      } as any,
      new ProfileCompletionService(),
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        intents: ["RELATIONSHIP"],
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(updateCompletionState).toHaveBeenCalled();
    expect(result.intents).toEqual(["RELATIONSHIP"]);
    expect(result.profileCompletion.isComplete).toBe(true);
  });
});

```

FILE: src/modules/interests/controllers/interest-catalog.controller.ts
```ts
import { Controller, Get, Query } from "@nestjs/common";
import { ListInterestTagsService } from "../application/interests.services";
import { InterestCatalogQueryDto, type InterestTagPageDto } from "../dto/interests.dto";

@Controller("interests")
export class InterestCatalogController {
  constructor(
    private readonly listInterestTagsService: ListInterestTagsService,
  ) {}

  @Get()
  async list(
    @Query() query: InterestCatalogQueryDto,
  ): Promise<InterestTagPageDto> {
    return this.listInterestTagsService.execute({
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 100) : 50,
      search: query.search,
    });
  }
}

```

FILE: src/modules/interests/controllers/my-interests.controller.ts
```ts
import { Body, Controller, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UpdateUserInterestsService } from "../application/interests.services";
import {
  UpdateMyInterestsDto,
  type UpdateMyInterestsResponseDto,
} from "../dto/interests.dto";

@Controller("users/me")
export class MyInterestsController {
  constructor(
    private readonly updateUserInterestsService: UpdateUserInterestsService,
  ) {}

  @Put("interests")
  async update(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateMyInterestsDto,
    @Req() request: Request,
  ): Promise<UpdateMyInterestsResponseDto> {
    return this.updateUserInterestsService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/interests/controllers/my-intents.controller.ts
```ts
import { Body, Controller, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UpdateUserIntentsService } from "../application/interests.services";
import {
  UpdateMyIntentsDto,
  type UpdateMyIntentsResponseDto,
} from "../dto/interests.dto";

@Controller("users/me")
export class MyIntentsController {
  constructor(
    private readonly updateUserIntentsService: UpdateUserIntentsService,
  ) {}

  @Put("intents")
  async update(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateMyIntentsDto,
    @Req() request: Request,
  ): Promise<UpdateMyIntentsResponseDto> {
    return this.updateUserIntentsService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/interests/interests.module.ts
```ts
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { UsersModule } from "../users/users.module";
import {
  InterestCatalogService,
  ListInterestTagsService,
  UpdateUserInterestsService,
  UpdateUserIntentsService,
  UserIntentReaderService,
} from "./application/interests.services";
import { InterestCatalogController } from "./controllers/interest-catalog.controller";
import { MyInterestsController } from "./controllers/my-interests.controller";
import { MyIntentsController } from "./controllers/my-intents.controller";
import {
  IntentCompatibilityService,
  InterestOwnershipPolicy,
  InterestValidationService,
} from "./domain/interests.domain";
import {
  InterestProfileCompletionRepository,
  InterestTagRepository,
  UserInterestRepository,
  UserIntentRepository,
} from "./infrastructure/interests.infrastructure";

@Module({
  imports: [UsersModule],
  controllers: [
    InterestCatalogController,
    MyInterestsController,
    MyIntentsController,
  ],
  providers: [
    AuditLogService,
    ProfileCompletionService,
    InterestCatalogService,
    UserIntentReaderService,
    ListInterestTagsService,
    UpdateUserInterestsService,
    UpdateUserIntentsService,
    InterestValidationService,
    IntentCompatibilityService,
    InterestOwnershipPolicy,
    InterestTagRepository,
    UserInterestRepository,
    UserIntentRepository,
    InterestProfileCompletionRepository,
  ],
  exports: [InterestCatalogService, IntentCompatibilityService, UserIntentReaderService],
})
export class InterestsModule {}

```

