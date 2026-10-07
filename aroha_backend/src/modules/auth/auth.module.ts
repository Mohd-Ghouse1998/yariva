import { Module } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import authConfig from "../../config/auth.config";
import { AuditLogService } from "../../common/services/audit-log.service";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { AuthController } from "./controllers/auth.controller";
import {
  AuthContextService,
  LoginService,
  LogoutService,
  RefreshTokenService,
  SignupService,
} from "./application/auth.services";
import {
  AuthEligibilityService,
  CredentialVerificationService,
  PasswordPolicyService,
} from "./domain/auth.domain";
import {
  AuthSessionWriteRepository,
  AuthUserReadRepository,
  JwtTokenService,
  OpaqueRefreshTokenService,
  PasswordHasherService,
} from "./infrastructure/auth.infrastructure";
import {
  LocalCredentialPolicy,
  RefreshTokenPolicy,
} from "./policies/auth.policies";
import { OtpAuthService } from "./application/otp-auth.service";
import { OtpProviderService } from "./infrastructure/otp-provider.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        secret: config.jwtAccessSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuditLogService,
    ProfileCompletionService,
    AuthContextService,
    SignupService,
    LoginService,
    RefreshTokenService,
    LogoutService,
    OtpAuthService,
    OtpProviderService,
    PasswordPolicyService,
    CredentialVerificationService,
    AuthEligibilityService,
    PasswordHasherService,
    OpaqueRefreshTokenService,
    JwtTokenService,
    AuthUserReadRepository,
    AuthSessionWriteRepository,
    LocalCredentialPolicy,
    RefreshTokenPolicy,
  ],
  exports: [AuthContextService, CredentialVerificationService],
})
export class AuthModule {}
