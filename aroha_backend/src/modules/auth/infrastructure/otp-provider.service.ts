import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import otpConfig from "../../../config/otp.config";

type ProviderPayload = Record<string, unknown>;

@Injectable()
export class OtpProviderService {
  constructor(
    @Inject(otpConfig.KEY)
    private readonly config: ConfigType<typeof otpConfig>,
  ) {}

  isEnabled(): boolean {
    return this.config.provider !== "disabled";
  }

  async sendSms(phone: string): Promise<void> {
    this.assertEnabled();
    if (this.config.provider === "twilio") {
      await this.sendWithTwilio(phone);
      return;
    }
    await this.sendWithMsg91(phone);
  }

  async verifySms(phone: string, code: string): Promise<boolean> {
    this.assertEnabled();
    return this.config.provider === "twilio"
      ? this.verifyWithTwilio(phone, code)
      : this.verifyWithMsg91(phone, code);
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new AppException(
        503,
        ERROR_CODES.AUTH_OTP_UNAVAILABLE,
        "Phone OTP is not configured",
      );
    }
  }

  private async sendWithTwilio(phone: string): Promise<void> {
    const body = new URLSearchParams({ To: phone, Channel: "sms" });
    const response = await this.request(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(
        this.config.twilio.verifyServiceSid,
      )}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.config.twilio.accountSid}:${this.config.twilio.authToken}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (!response.ok) this.throwUnavailable();
  }

  private async verifyWithTwilio(
    phone: string,
    code: string,
  ): Promise<boolean> {
    const body = new URLSearchParams({ To: phone, Code: code });
    const response = await this.request(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(
        this.config.twilio.verifyServiceSid,
      )}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.config.twilio.accountSid}:${this.config.twilio.authToken}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (response.status === 400 || response.status === 404) return false;
    if (!response.ok) this.throwUnavailable();
    const payload = await readJson(response);
    return payload.status === "approved";
  }

  private async sendWithMsg91(phone: string): Promise<void> {
    const query = new URLSearchParams({
      template_id: this.config.msg91.templateId,
      mobile: withoutLeadingPlus(phone),
    });
    const response = await this.request(
      `https://control.msg91.com/api/v5/otp?${query.toString()}`,
      {
        method: "POST",
        headers: { authkey: this.config.msg91.authKey },
      },
    );
    if (!response.ok) this.throwUnavailable();
    const payload = await readJson(response);
    if (!isMsg91Success(payload)) this.throwUnavailable();
  }

  private async verifyWithMsg91(phone: string, code: string): Promise<boolean> {
    const query = new URLSearchParams({
      otp: code,
      mobile: withoutLeadingPlus(phone),
    });
    const response = await this.request(
      `https://control.msg91.com/api/v5/otp/verify?${query.toString()}`,
      {
        method: "GET",
        headers: { authkey: this.config.msg91.authKey },
      },
    );
    if (response.status === 400 || response.status === 404) return false;
    if (!response.ok) this.throwUnavailable();
    return isMsg91Success(await readJson(response));
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch {
      this.throwUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  private throwUnavailable(): never {
    throw new AppException(
      503,
      ERROR_CODES.AUTH_OTP_UNAVAILABLE,
      "Phone verification is temporarily unavailable",
    );
  }
}

function withoutLeadingPlus(phone: string): string {
  return phone.startsWith("+") ? phone.slice(1) : phone;
}

async function readJson(response: Response): Promise<ProviderPayload> {
  try {
    const payload: unknown = await response.json();
    return typeof payload === "object" && payload !== null
      ? (payload as ProviderPayload)
      : {};
  } catch {
    return {};
  }
}

function isMsg91Success(payload: ProviderPayload): boolean {
  if (payload.type === "success") return true;
  const message =
    typeof payload.message === "string" ? payload.message.toLowerCase() : "";
  return message.includes("success") || message.includes("verified");
}
