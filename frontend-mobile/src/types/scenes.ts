export type SceneIntent = "DATING" | "FRIENDSHIP" | "CASUAL_HANG";
export type SceneStatus = "ACTIVE" | "ENDED" | "EXPIRED" | "REPLACED";

export interface SceneDto {
  id: string;
  ownerId: string;
  lineageId: string;
  version: number;
  intent: SceneIntent;
  activity: string;
  photo: {
    id: string;
    url: string;
    width: number | null;
    height: number | null;
  } | null;
  tags: string[];
  availableFrom: string | null;
  availableUntil: string | null;
  expiresAt: string;
  status: SceneStatus;
  createdAt: string;
}

export interface SceneInput {
  intent: SceneIntent;
  activity: string;
  photoId?: string | null;
  tags?: string[];
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export interface SceneCandidateDto {
  scene: SceneDto;
  profile: {
    userId: string;
    displayName: string;
    headline: string | null;
    city: string | null;
    region: string | null;
    verificationStatus: string;
    photoUrl: string | null;
  };
  distance: { roundedKm: number; band: "LOCAL" | "NEARBY" | "FARTHER" };
  availability: "CONFIRMED" | "UNCONFIRMED";
}

export interface SceneCapabilitiesDto {
  enabled: boolean;
  radiusMeters: number;
  lifetimeHours: number;
}
