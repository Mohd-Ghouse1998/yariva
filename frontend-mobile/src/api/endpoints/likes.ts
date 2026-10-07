import type {
  CreateLikeRequest,
  CreateLikeResponseDto,
  CreatePassRequest,
  PassDto,
  ReceivedLikesResponseDto,
} from "../../types/discovery";
import { http } from "../http";

export const likesApi = {
  like: (body: CreateLikeRequest, idempotencyKey?: string) =>
    http.post<CreateLikeResponseDto>("likes", body, {
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  unlike: (targetUserId: string) => http.delete<void>(`likes/${targetUserId}`),
  pass: (body: CreatePassRequest) => http.post<PassDto>("passes", body),
  unpass: (targetUserId: string) => http.delete<void>(`passes/${targetUserId}`),
  // GET /likes/received — list of incoming likes for the Likes tab.
  received: (params?: { cursor?: string | null; limit?: number }) =>
    http.get<ReceivedLikesResponseDto>("likes/received", {
      cursor: params?.cursor ?? undefined,
      limit: params?.limit ?? 30,
    }),
};
