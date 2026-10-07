import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateBlockDto {
  @IsUUID("4")
  readonly blockedUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly reason?: string | null;
}

export interface BlockDto {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockResponseDto {
  block: BlockDto;
}

export interface BlockPageDto {
  items: BlockDto[];
  nextCursor: string | null;
}

