import { Transform } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString,
  IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength,
} from "class-validator";
import { ConnectionIntent } from "../../generated/prisma/client";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const trimItems = ({ value }: { value: unknown }) => Array.isArray(value)
  ? value.map((item) => typeof item === "string" ? item.trim() : item) : value;

export class CircleListDto {
  @IsOptional() @IsIn(["own", "nearby"])
  scope?: "own" | "nearby";

  @IsOptional() @IsString() @MaxLength(256)
  cursor?: string;
}

export class CircleContentDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80)
  title!: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500)
  description!: string;
}

export class CreateCircleDto extends CircleContentDto {
  @IsIn(Object.values(ConnectionIntent))
  intent!: ConnectionIntent;

  @IsInt() @Min(4) @Max(6)
  capacity!: number;
}

export class ActivityContentDto extends CircleContentDto {
  @IsOptional() @IsUUID()
  venueId?: string | null;

  @IsOptional() @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  startsAt?: string | null;

  @IsInt() @Min(1) @Max(6)
  capacity!: number;

  @IsBoolean()
  openToNearby!: boolean;
}

export class CreateCircleActivityDto extends ActivityContentDto {
  @Transform(trimItems) @IsArray() @ArrayMaxSize(3) @ArrayUnique()
  @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(60, { each: true })
  helpNeeds!: string[];
}

export class UpdateCircleActivityDto extends ActivityContentDto {
  @IsInt() @Min(1)
  version!: number;
}

export class CircleDecisionDto {
  @IsBoolean()
  approve!: boolean;
}

export class CloseCircleDto {
  @IsBoolean()
  cancel!: boolean;
}

export class SetConnectionIntentDto {
  @IsInt() @Min(0)
  version!: number;

  @IsIn([...Object.values(ConnectionIntent), null])
  intent!: ConnectionIntent | null;
}

export class SetVibeTogetherDto {
  @IsInt() @Min(0)
  version!: number;

  @IsIn(["START", "ACCEPT", "ANSWER", "SKIP"])
  action!: "START" | "ACCEPT" | "ANSWER" | "SKIP";

  @IsOptional() @Transform(trimItems) @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2)
  @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(160, { each: true })
  answers?: string[];
}
