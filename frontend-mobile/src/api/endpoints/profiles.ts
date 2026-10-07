import type {
  CommunicationPreferenceDto,
  DiscoveryPreferenceDto,
  FinalizeProfilePhotoUploadRequest,
  FinalizeProfilePhotoUploadResponse,
  InitiateProfilePhotoUploadRequest,
  InitiateProfilePhotoUploadResponse,
  LifestyleDto,
  MyProfileDto,
  ProfilePhotoListResponse,
  ProfilePhotoResponse,
  PublicProfileDto,
  ReorderProfilePhotosRequest,
  SchedulePreferenceDto,
  UpdateMyProfileRequest,
  UpdateCommunicationPreferenceRequest,
  UpdateDiscoveryPreferenceRequest,
  UpdateLifestyleRequest,
  UpdateSchedulePreferenceRequest,
} from "../../types/profile";
import { http } from "../http";

export const profilesApi = {
  me: () => http.get<{ profile: MyProfileDto }>("profiles/me").then((response) => response.profile),
  publicById: (userId: string) =>
    http
      .get<{ profile: PublicProfileDto }>(`profiles/${encodeURIComponent(userId)}`)
      .then((response) => response.profile),
  updateMe: (body: UpdateMyProfileRequest) =>
    http.patch<{ profile: MyProfileDto }>("profiles/me", body).then((response) => response.profile),
  setLifestyle: (body: UpdateLifestyleRequest) =>
    http.put<{ value: LifestyleDto }>("profiles/me/lifestyle", body),
  setSchedule: (body: UpdateSchedulePreferenceRequest) =>
    http.put<{ value: SchedulePreferenceDto }>("profiles/me/schedule-preference", body),
  setDiscovery: (body: UpdateDiscoveryPreferenceRequest) =>
    http.put<{ value: DiscoveryPreferenceDto }>("profiles/me/discovery-preference", body),
  setCommunication: (body: UpdateCommunicationPreferenceRequest) =>
    http.put<{ value: CommunicationPreferenceDto }>("profiles/me/communication-preference", body),
  initiatePhotoUpload: (body: InitiateProfilePhotoUploadRequest) =>
    http.post<InitiateProfilePhotoUploadResponse>("profiles/photos/upload", body),
  finalizePhoto: (body: FinalizeProfilePhotoUploadRequest) =>
    http.post<FinalizeProfilePhotoUploadResponse>("profiles/photos/finalize", body),
  photo: (photoId: string) =>
    http
      .get<ProfilePhotoResponse>(`profiles/photos/${encodeURIComponent(photoId)}`)
      .then((response) => response.photo),
  reorderPhotos: (body: ReorderProfilePhotosRequest) =>
    http.patch<ProfilePhotoListResponse>("profiles/photos/order", body),
  setPrimaryPhoto: (photoId: string) =>
    http.patch<ProfilePhotoResponse>(`profiles/photos/${photoId}/primary`),
  deletePhoto: (photoId: string) => http.delete<void>(`profiles/photos/${photoId}`),
};
