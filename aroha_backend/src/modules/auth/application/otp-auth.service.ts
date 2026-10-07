import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import {
  hashWithPepper,
  randomBase64Url,
} from "../../../common/utils/crypto.util";
import { normalizePhone } from "../../../common/utils/identifier.util";
import authConfig from "../../../config/auth.config";
import otpConfig from "../../../config/otp.config";
import { RedisService } from "../../../integrations/redis/redis.service";
import type {
  AuthCapabilitiesDto,
  AuthResponseDto,
  DeviceContextDto,
  OtpPurposeValue,
  RequestOtpResponseDto,
} from "../dto/auth.dto";
import { OtpProviderService } from "../infrastructure/otp-provider.service";
import {
  LoginService,
  type RequestMetadata,
  SignupService,
} from "./auth.services";

interface OtpChallenge {
  purpose: OtpPurposeValue;
  requestedAt: string;
}

@Injectable()
export class OtpAuthService {
  constructor(
    private readonly redis: RedisService,
    private readonly provider: OtpProviderService,
    private readonly loginService: LoginService,
    private readonly signupService: SignupService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
    @Inject(otpConfig.KEY)
    private readonly config: ConfigType<typeof otpConfig>,
  ) {}

  capabilities(): AuthCapabilitiesDto {
    const enabled = this.provider.isEnabled();
    return { otp: { enabled, channel: enabled ? "SMS" : null } };
  }

  async request(input: {
    phone: string;
    purpose: OtpPurposeValue;
  }): Promise<RequestOtpResponseDto> {
    this.assertEnabled();
    const phone = normalizePhone(input.phone);
    const keys = this.keys(phone);
    const cooldownCreated = await this.redis.set(
      keys.cooldown,
      "1",
      "EX",
      this.config.resendCooldownSeconds,
      "NX",
    );
    if (cooldownCreated !== "OK") {
      throw new AppException(
        429,
        ERROR_CODES.AUTH_OTP_COOLDOWN,
        "Please wait before requesting another code",
        { retryAfterSeconds: this.config.resendCooldownSeconds },
      );
    }

    try {
      await this.provider.sendSms(phone);
      const challenge: OtpChallenge = {
        purpose: input.purpose,
        requestedAt: new Date().toISOString(),
      };
      await this.redis
        .multi()
        .set(
          keys.challenge,
          JSON.stringify(challenge),
          "EX",
          this.config.challengeTtlSeconds,
        )
        .del(keys.attempts)
        .exec();
    } catch (error) {
      await this.redis.del(keys.cooldown);
      throw error;
    }

    return {
      expiresInSeconds: this.config.challengeTtlSeconds,
      resendAfterSeconds: this.config.resendCooldownSeconds,
    };
  }

  async verify(
    input: {
      phone: string;
      purpose: OtpPurposeValue;
      code: string;
      device: DeviceContextDto;
    },
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    this.assertEnabled();
    const phone = normalizePhone(input.phone);
    const keys = this.keys(phone);
    const challenge = parseChallenge(await this.redis.get(keys.challenge));
    if (!challenge || challenge.purpose !== input.purpose) this.throwInvalid();

    const attempts = await this.redis.incr(keys.attempts);
    if (attempts === 1) {
      await this.redis.expire(keys.attempts, this.config.challengeTtlSeconds);
    }
    if (attempts > this.config.maxVerifyAttempts) {
      await this.redis.del(keys.challenge, keys.attempts);
      this.throwInvalid();
    }

    const approved = await this.provider.verifySms(phone, input.code);
    if (!approved) this.throwInvalid();

    await this.redis.del(keys.challenge, keys.attempts, keys.cooldown);

    if (input.purpose === "LOGIN") {
      return this.loginService.executeVerifiedPhone(
        phone,
        input.device,
        metadata,
      );
    }

    return this.signupService.execute(
      {
        phone,
        password: randomBase64Url(48),
        device: input.device,
      },
      metadata,
      "otp",
    );
  }

  private keys(phone: string): {
    challenge: string;
    attempts: string;
    cooldown: string;
  } {
    const identity = hashWithPepper(phone, this.auth.passwordPepper);
    return {
      challenge: `auth:otp:challenge:${identity}`,
      attempts: `auth:otp:attempts:${identity}`,
      cooldown: `auth:otp:cooldown:${identity}`,
    };
  }

  private assertEnabled(): void {
    if (!this.provider.isEnabled()) {
      throw new AppException(
        503,
        ERROR_CODES.AUTH_OTP_UNAVAILABLE,
        "Phone OTP is not configured",
      );
    }
  }

  private throwInvalid(): never {
    throw new AppException(
      401,
      ERROR_CODES.AUTH_OTP_INVALID,
      "The verification code is invalid or expired",
    );
  }
}

function parseChallenge(value: string | null): OtpChallenge | null {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "purpose" in candidate &&
      (candidate.purpose === "LOGIN" || candidate.purpose === "SIGNUP") &&
      "requestedAt" in candidate &&
      typeof candidate.requestedAt === "string"
    ) {
      return candidate as OtpChallenge;
    }
  } catch {
    return null;
  }
  return null;
}
