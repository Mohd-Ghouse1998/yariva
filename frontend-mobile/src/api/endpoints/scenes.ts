import type {
  SceneCandidateDto,
  SceneCapabilitiesDto,
  SceneDto,
  SceneInput,
} from "../../types/scenes";
import { http } from "../http";

export const scenesApi = {
  capabilities: () => http.get<SceneCapabilitiesDto>("scenes/capabilities"),
  mine: () => http.get<{ scene: SceneDto | null }>("scenes/me"),
  forUser: (userId: string) => http.get<{ scene: SceneDto | null }>(`scenes/users/${userId}`),
  create: (input: SceneInput) => http.post<{ scene: SceneDto }>("scenes", input),
  update: (sceneId: string, input: Partial<SceneInput>) =>
    http.patch<{ scene: SceneDto }>(`scenes/${sceneId}`, input),
  end: (sceneId: string) => http.post<{ scene: SceneDto }>(`scenes/${sceneId}/end`),
  renew: (sceneId: string) => http.post<{ scene: SceneDto }>(`scenes/${sceneId}/renew`),
  discover: (cursor?: string, limit = 10) =>
    http.get<{ items: SceneCandidateDto[]; nextCursor: string | null }>("scenes/discover", {
      cursor,
      limit,
    }),
};
