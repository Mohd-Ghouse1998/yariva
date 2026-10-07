export type VibeFilter = "ORIGINAL" | "WARM" | "COOL" | "MONO" | "POP";

export type VibeAudioMode = "ORIGINAL" | "MUTED" | "CUSTOM";

export type VibeStatus =
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "FAILED"
  | "REMOVED";

export interface VibeUploadAssetInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface VibeUploadInstruction {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface InitiateVibeUploadResponse {
  vibeId: string;
  video: VibeUploadInstruction;
  music: VibeUploadInstruction | null;
}

export interface VibeDto {
  id: string;
  userId: string;
  status: VibeStatus;
  filter: VibeFilter;
  audioMode: VibeAudioMode;
  musicName: string | null;
  durationMs: number | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateVibeUploadRequest {
  video: VibeUploadAssetInput;
  music: VibeUploadAssetInput | null;
  filter: VibeFilter;
  audioMode: VibeAudioMode;
}

export interface FinalizeVibeUploadRequest {
  video: {
    uploadToken: string;
    objectKey: string;
    bucket: string;
    mimeType: string;
    sizeBytes: number;
  };
  music: {
    uploadToken: string;
    objectKey: string;
    bucket: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
}
