import { ArrayMaxSize, Equals, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export const COMMUNITY_LABELS = ["STRAIGHT", "GAY", "LESBIAN", "BISEXUAL", "PANSEXUAL", "QUEER", "ASEXUAL", "QUESTIONING", "SELF_DESCRIBE", "PREFER_NOT_TO_SAY"] as const;
export type CommunityLabel = typeof COMMUNITY_LABELS[number];

export class AudienceDto {
  @IsIn(["SELECTED", "ALL_APPROVED"])
  audienceRule!: "SELECTED" | "ALL_APPROVED";

  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID("4", { each: true })
  recipientIds?: string[];

  @IsOptional() @IsIn(COMMUNITY_LABELS)
  communityFilter?: CommunityLabel;
}

export class InitiatePrivateStoryMediaDto {
  @IsIn(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"])
  mimeType!: string;
  @IsInt() @Min(1) @Max(40 * 1024 * 1024)
  sizeBytes!: number;
}

export class PrivateStoryMediaDto extends InitiatePrivateStoryMediaDto {
  @IsString() @MinLength(16) @MaxLength(128)
  uploadToken!: string;
  @IsString() @MaxLength(512)
  objectKey!: string;
}

export class CreatePrivateStoryDto extends AudienceDto {
  @IsOptional() @IsString() @MaxLength(2000)
  text?: string;
  @IsOptional() @ValidateNested() @Type(() => PrivateStoryMediaDto)
  media?: PrivateStoryMediaDto;
}

export class UpdatePrivateStoryDto extends AudienceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000)
  text?: string;
  @IsOptional() @Equals(true)
  confirmAudienceExpansion?: true;
}

export class PrivateCommunityDto {
  @IsArray() @ArrayMaxSize(10) @IsIn(COMMUNITY_LABELS, { each: true })
  identifyAs!: CommunityLabel[];
  @IsArray() @ArrayMaxSize(10) @IsIn(COMMUNITY_LABELS, { each: true })
  connectWith!: CommunityLabel[];
  @IsArray() @ArrayMaxSize(10) @IsIn(COMMUNITY_LABELS, { each: true })
  optedInCommunities!: CommunityLabel[];
  @IsOptional() @IsString() @MaxLength(120)
  selfDescription?: string;
}
