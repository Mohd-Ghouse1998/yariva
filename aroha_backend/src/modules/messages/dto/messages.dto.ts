import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import type { MessageDto } from "../../conversations/dto/conversations.dto";

export const MESSAGE_ATTACHMENT_MIME_TYPE_VALUES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
] as const;

export const MESSAGE_ATTACHMENT_TYPE_VALUES = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
] as const;

export type MessageAttachmentMimeTypeValue =
  (typeof MESSAGE_ATTACHMENT_MIME_TYPE_VALUES)[number];
export type MessageAttachmentTypeValue =
  (typeof MESSAGE_ATTACHMENT_TYPE_VALUES)[number];

export class InitiateMessageAttachmentUploadDto {
  @IsUUID("4")
  readonly conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly fileName!: string;

  @IsIn(MESSAGE_ATTACHMENT_MIME_TYPE_VALUES)
  readonly mimeType!: MessageAttachmentMimeTypeValue;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  readonly sizeBytes!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  readonly sha256?: string | null;
}

export interface InitiateMessageAttachmentUploadResponseDto {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export class CreateConversationMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly clientMessageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly textBody!: string;

  @IsOptional()
  @ValidateIf(({ replyToMessageId }) => replyToMessageId !== null)
  @IsUUID("4")
  readonly replyToMessageId?: string | null;
}

export interface MessageResponseDto {
  message: MessageDto;
}

export class FinalizeMessageAttachmentDto {
  @IsUUID("4")
  readonly conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly clientMessageId!: string;

  @IsIn(MESSAGE_ATTACHMENT_TYPE_VALUES)
  readonly type!: MessageAttachmentTypeValue;

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

  @IsIn(MESSAGE_ATTACHMENT_MIME_TYPE_VALUES)
  readonly mimeType!: MessageAttachmentMimeTypeValue;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  readonly sizeBytes!: number;

  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @ValidateIf(({ width }) => width !== null && width !== undefined)
  @IsInt()
  @Min(1)
  readonly width?: number | null;

  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @ValidateIf(({ height }) => height !== null && height !== undefined)
  @IsInt()
  @Min(1)
  readonly height?: number | null;

  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @ValidateIf(
    ({ durationSeconds }) =>
      durationSeconds !== null && durationSeconds !== undefined,
  )
  @IsInt()
  @Min(1)
  readonly durationSeconds?: number | null;

  @IsOptional()
  @ValidateIf(({ replyToMessageId }) => replyToMessageId !== null)
  @IsUUID("4")
  readonly replyToMessageId?: string | null;
}

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly textBody!: string;
}
