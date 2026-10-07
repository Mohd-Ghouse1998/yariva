import { Equals, IsBoolean, IsIn, IsISO8601, IsString, MaxLength } from "class-validator";
export class JoinBlindEventDto {
  @IsIn(["DATING", "FRIENDSHIP"]) intent!: "DATING" | "FRIENDSHIP";
  @Equals(true) blindConsent!: true;
  @IsBoolean() notificationsEnabled!: boolean;
}
export class ScheduleBlindEventDto {
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsString() @MaxLength(120) city!: string;
}
