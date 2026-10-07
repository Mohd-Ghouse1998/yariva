import type {
  FinalizeVibeUploadRequest,
  InitiateVibeUploadRequest,
  InitiateVibeUploadResponse,
  VibeDto,
} from "../../types/vibe";
import { http } from "../http";

export const vibesApi = {
  mine: () => http.get<{ vibe: VibeDto | null }>("vibes/me"),
  forUser: (userId: string) =>
    http.get<{ vibe: VibeDto | null }>(`vibes/users/${userId}`),
  initiateUpload: (input: InitiateVibeUploadRequest) =>
    http.post<InitiateVibeUploadResponse>("vibes/upload", input),
  finalizeUpload: (vibeId: string, input: FinalizeVibeUploadRequest) =>
    http.post<{ vibe: VibeDto }>(`vibes/${vibeId}/finalize`, input),
  remove: (vibeId: string) => http.delete<void>(`vibes/${vibeId}`),
};
