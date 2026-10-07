import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";

export const CALL_TYPE_VALUES = ["VOICE", "VIDEO"] as const;
export const CALL_END_REASON_VALUES = ["HANGUP"] as const;

export type CallTypeValue = (typeof CALL_TYPE_VALUES)[number];

export interface IceServerDto {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface CallSessionDto {
  id: string;
  matchId: string;
  conversationId: string;
  initiatorUserId: string;
  receiverUserId: string;
  callType: "VOICE" | "VIDEO";
  purpose: "STANDARD" | "VOICE_INTRODUCTION";
  introductionPrompt: string | null;
  suggestedDurationSeconds: number | null;
  status:
    | "RINGING"
    | "ACCEPTED"
    | "CONNECTING"
    | "CONNECTED"
    | "DECLINED"
    | "CANCELED"
    | "MISSED"
    | "ENDED"
    | "TIMED_OUT"
    | "FAILED";
  signalingVersion: number;
  ringStartedAt: string | null;
  acceptedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  expiresAt: string;
  endReason:
    | "HANGUP"
    | "DECLINED"
    | "CANCELED"
    | "MISSED"
    | "BLOCKED"
    | "UNMATCHED"
    | "PERMISSION_REVOKED"
    | "TIMEOUT"
    | "ERROR"
    | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateCallResponseDto {
  call: CallSessionDto;
  iceServers: IceServerDto[];
}

export interface AcceptCallResponseDto {
  call: CallSessionDto;
  iceServers: IceServerDto[];
}

export interface CallResponseDto {
  call: CallSessionDto;
}

export interface CallRingingEventDto {
  call: CallSessionDto;
  otherUser: PublicProfileDto;
  iceServers: IceServerDto[];
}

export interface CallAcceptedElsewhereEventDto {
  callId: string;
  acceptedBySessionId: string;
  occurredAt: string;
}

export interface CallSignalEventDto {
  callId: string;
  signalingVersion: number;
  fromUserId: string;
}

export interface CallOfferEventDto extends CallSignalEventDto {
  sdp: string;
}

export interface CallAnswerEventDto extends CallSignalEventDto {
  sdp: string;
}

export interface IceCandidateDto {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number;
  usernameFragment: string | null;
}

export interface CallIceEventDto extends CallSignalEventDto {
  candidate: IceCandidateDto;
}

export class InitiateCallDto {
  @IsUUID("4")
  readonly matchId!: string;

  @IsIn(CALL_TYPE_VALUES)
  readonly callType!: CallTypeValue;

  @IsOptional()
  @IsIn(["STANDARD", "VOICE_INTRODUCTION"])
  readonly purpose?: "STANDARD" | "VOICE_INTRODUCTION";
}

export class EmptyCallActionDto {}

export class EndCallDto {
  @IsIn(CALL_END_REASON_VALUES)
  readonly reason!: "HANGUP";
}

export class CallRingAckWsDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsUUID("4")
  readonly callId!: string;
}

export class CallOfferWsDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsUUID("4")
  readonly callId!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  readonly signalingVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250_000)
  readonly sdp!: string;
}

export class CallAnswerWsDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsUUID("4")
  readonly callId!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  readonly signalingVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250_000)
  readonly sdp!: string;
}

export class CallIceCandidateWsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  readonly candidate!: string;

  @IsOptional()
  @IsString()
  readonly sdpMid?: string | null;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  readonly sdpMLineIndex!: number;

  @IsOptional()
  @IsString()
  readonly usernameFragment?: string | null;
}

export class CallIceWsDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsUUID("4")
  readonly callId!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  readonly signalingVersion!: number;

  @IsObject()
  @ValidateNested()
  @Transform(({ value }) => value)
  readonly candidate!: CallIceCandidateWsDto;
}
