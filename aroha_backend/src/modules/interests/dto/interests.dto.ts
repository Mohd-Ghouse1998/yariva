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
  "DATING",
  "COMMITTED_RELATIONSHIP",
  "MARRIAGE_MINDED",
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
