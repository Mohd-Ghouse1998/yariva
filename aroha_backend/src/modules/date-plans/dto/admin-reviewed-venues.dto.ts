import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class AdminVenueQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsOptional() @IsString() @MaxLength(1024) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
export class CurateReviewedVenueDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) address!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) publicLocality!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsString() @MaxLength(2) countryCode!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsIn(["PENDING", "REVIEWED", "REJECTED"]) reviewStatus!: "PENDING" | "REVIEWED" | "REJECTED";
  @IsIn(["OPEN", "CLOSED", "UNKNOWN"]) operationalStatus!: "OPEN" | "CLOSED" | "UNKNOWN";
  @IsIn(["CAFE", "RESTAURANT", "ACTIVITY", "OTHER"]) category!: "CAFE" | "RESTAURANT" | "ACTIVITY" | "OTHER";
  @IsOptional() @IsString() @MaxLength(200) reviewSource?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) reviewedAt?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) priceMinPerPerson?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) priceMaxPerPerson?: number | null;
  @IsOptional() @IsString() @MaxLength(1024) photoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) photoRights?: string | null;
  @IsOptional() @IsBoolean() deleted?: boolean;
}
export class ReviewedVenueImportItemDto extends CurateReviewedVenueDto {
  @IsUUID() id!: string;
}
export class ImportReviewedVenuesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ReviewedVenueImportItemDto)
  items!: ReviewedVenueImportItemDto[];
}
