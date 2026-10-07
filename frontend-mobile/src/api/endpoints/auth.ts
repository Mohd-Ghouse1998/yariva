import type {
  AuthResponseDto,
  AuthCapabilitiesDto,
  LoginRequest,
  RequestOtpRequest,
  RequestOtpResponseDto,
  RefreshResponseDto,
  RefreshTokenRequest,
  SignupRequest,
  VerifyOtpRequest,
} from "../../types/auth";
import { http } from "../http";

export const authApi = {
  capabilities: () =>
    http.get<AuthCapabilitiesDto>("auth/capabilities", undefined, { skipAuth: true }),
  signup: (body: SignupRequest) =>
    http.post<AuthResponseDto>("auth/signup", body, { skipAuth: true }),
  login: (body: LoginRequest) => http.post<AuthResponseDto>("auth/login", body, { skipAuth: true }),
  requestOtp: (body: RequestOtpRequest) =>
    http.post<RequestOtpResponseDto>("auth/otp/request", body, { skipAuth: true }),
  verifyOtp: (body: VerifyOtpRequest) =>
    http.post<AuthResponseDto>("auth/otp/verify", body, { skipAuth: true }),
  refresh: (body: RefreshTokenRequest) =>
    http.post<RefreshResponseDto>("auth/refresh", body, { skipAuth: true }),
  logout: () => http.post<void>("auth/logout"),
};
