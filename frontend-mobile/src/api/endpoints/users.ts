import type { GetMeResponseDto } from "../../types/auth";
import type { ConnectionIntent } from "../../types/enums";
import type { UpdateMyIntentsResponseDto, UpdateMyInterestsResponseDto } from "../../types/profile";
import { http } from "../http";

export const usersApi = {
  me: () => http.get<GetMeResponseDto>("users/me"),
  setIntents: (intents: ConnectionIntent[]) =>
    http.put<UpdateMyIntentsResponseDto>("users/me/intents", { intents }),
  setInterests: (interestIds: string[]) =>
    http.put<UpdateMyInterestsResponseDto>("users/me/interests", {
      interestTagIds: interestIds,
    }),
};
