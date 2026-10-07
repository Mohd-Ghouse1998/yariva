import type { Request } from "express";

export type UserRoleValue = "USER" | "MODERATOR" | "ADMIN";
export type UserStatusValue =
  | "ACTIVE"
  | "RESTRICTED"
  | "SUSPENDED"
  | "BANNED"
  | "DELETED";

export interface JwtAccessPayload {
  sub: string;
  sid: string;
  role: UserRoleValue;
  status: UserStatusValue;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: UserRoleValue;
    status: UserStatusValue;
    isShadowBanned: boolean;
    isDiscoveryFrozen: boolean;
    isChatFrozen: boolean;
    isCallFrozen: boolean;
    lastActiveAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    id: string;
    deviceId: string | null;
    deviceName: string | null;
    platform: string;
    appVersion: string | null;
    lastSeenAt: string | null;
    createdAt: string;
    revokedAt: string | null;
  };
  tokenJti: string;
}

export interface AuthenticatedRequest extends Request {
  requestId?: string;
  auth: AuthContext;
}
