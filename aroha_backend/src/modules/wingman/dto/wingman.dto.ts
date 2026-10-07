import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateWingmanInvitationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(320)
  identifier!: string;
}

export class RespondWingmanInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token?: string;
}

export class WingmanSceneConsentDto {
  @IsUUID()
  sceneId!: string;

  @IsInt()
  @Min(1)
  sceneVersion!: number;
}

export interface WingmanPersonDto {
  userId: string;
  displayName: string;
}

export interface WingmanInvitationDto {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
  direction: "SENT" | "RECEIVED";
  expiresAt: string;
  inviter: WingmanPersonDto | null;
}

export interface WingmanPartyDto {
  id: string;
  status: "PENDING" | "ACTIVE" | "DISCONNECTED";
  membershipVersion: number;
  role: "OWNER" | "BUDDY";
  buddy: WingmanPersonDto | null;
  invitation: WingmanInvitationDto | null;
  sceneConsent: {
    current: boolean;
    sceneId: string | null;
    sceneVersion: number | null;
  };
  buddySceneConsented: boolean;
  bothSceneConsented: boolean;
  activatedAt: string | null;
  disconnectedAt: string | null;
}

export interface WingmanStateDto {
  state: "NONE" | "PENDING" | "ACTIVE" | "DISCONNECTED";
  party: WingmanPartyDto | null;
}

export interface WingmanCapabilitiesDto {
  enabled: boolean;
  invitationTtlHours: number;
}
