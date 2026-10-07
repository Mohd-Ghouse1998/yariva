import { ApiError, isNetworkError } from "../../api/errors";

export type ProfileLoadFailure = "offline" | "not-found" | "blocked" | "unavailable";

export const classifyProfileLoadFailure = (error: unknown): ProfileLoadFailure => {
  if (isNetworkError(error)) return "offline";
  if (error instanceof ApiError) {
    if (error.status === 404 || error.code === "PROFILE_NOT_FOUND") return "not-found";
    if (error.status === 403 || error.code === "FORBIDDEN") return "blocked";
  }
  return "unavailable";
};
