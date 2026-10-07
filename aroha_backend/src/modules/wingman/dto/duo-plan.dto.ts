import { IsDateString, IsIn, IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateDuoPlanDto {
  @IsUUID("4") readonly requestId!: string;
  @IsString() @IsNotEmpty() @MaxLength(140) readonly activity!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) readonly venueName!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) readonly publicLocality!: string;
  @IsDateString() readonly startAt!: string;
}

export class CounterDuoPlanDto extends CreateDuoPlanDto {
  @IsInt() @Min(1) readonly expectedVersion!: number;
}

export class RespondDuoPlanDto {
  @IsInt() @Min(1) readonly expectedVersion!: number;
  @IsIn(["ACCEPT", "DECLINE", "CANCEL"]) readonly action!: "ACCEPT" | "DECLINE" | "CANCEL";
}

export interface DuoPlanDto {
  id: string;
  conversationId: string;
  status: "DRAFT" | "PROPOSED" | "COUNTERED" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED";
  version: number;
  activity: string;
  venueName: string;
  publicLocality: string;
  startAt: string;
  acceptedUserIds: string[];
  participantCount: number;
}
