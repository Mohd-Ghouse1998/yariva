import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { OtpAuthService } from "./otp-auth.service";

const device = {
  deviceId: "device-1",
  deviceName: "Galaxy",
  platform: "ANDROID" as const,
  appVersion: "0.3.0",
};
const metadata = { ipAddress: "203.0.113.1", userAgent: "yariva-tests" };
const authResponse = { tokens: {}, user: {}, profileCompletion: {} } as never;

const build = () => {
  const pipeline = {
    set: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const redis = {
    set: jest.fn().mockResolvedValue("OK"),
    get: jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({
          purpose: "LOGIN",
          requestedAt: new Date().toISOString(),
        }),
      ),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    multi: jest.fn().mockReturnValue(pipeline),
  };
  const provider = {
    isEnabled: jest.fn().mockReturnValue(true),
    sendSms: jest.fn().mockResolvedValue(undefined),
    verifySms: jest.fn().mockResolvedValue(true),
  };
  const login = {
    executeVerifiedPhone: jest.fn().mockResolvedValue(authResponse),
  };
  const signup = { execute: jest.fn().mockResolvedValue(authResponse) };
  const service = new OtpAuthService(
    redis as never,
    provider as never,
    login as never,
    signup as never,
    { passwordPepper: "test-pepper" } as never,
    {
      provider: "twilio",
      challengeTtlSeconds: 600,
      resendCooldownSeconds: 30,
      maxVerifyAttempts: 5,
      requestTimeoutMs: 1_000,
    } as never,
  );
  return { service, redis, provider, login, signup, pipeline };
};

describe("OtpAuthService", () => {
  it("exposes OTP only when a real provider is configured", () => {
    const { service, provider } = build();
    expect(service.capabilities()).toEqual({
      otp: { enabled: true, channel: "SMS" },
    });
    provider.isEnabled.mockReturnValue(false);
    expect(service.capabilities()).toEqual({
      otp: { enabled: false, channel: null },
    });
  });

  it("normalizes the phone, sends a code, and stores an expiring challenge", async () => {
    const { service, provider, pipeline } = build();

    await expect(
      service.request({ phone: "+91 98765 43210", purpose: "LOGIN" }),
    ).resolves.toEqual({ expiresInSeconds: 600, resendAfterSeconds: 30 });

    expect(provider.sendSms).toHaveBeenCalledWith("+919876543210");
    expect(pipeline.set).toHaveBeenCalledWith(
      expect.stringContaining("auth:otp:challenge:"),
      expect.stringContaining('"purpose":"LOGIN"'),
      "EX",
      600,
    );
  });

  it("enforces the resend cooldown before calling the provider", async () => {
    const { service, redis, provider } = build();
    redis.set.mockResolvedValue(null);

    await expect(
      service.request({ phone: "+919876543210", purpose: "LOGIN" }),
    ).rejects.toMatchObject({ code: ERROR_CODES.AUTH_OTP_COOLDOWN });
    expect(provider.sendSms).not.toHaveBeenCalled();
  });

  it("uses the normal session path after a verified login code", async () => {
    const { service, provider, login } = build();

    await expect(
      service.verify(
        { phone: "+91 98765 43210", purpose: "LOGIN", code: "123456", device },
        metadata,
      ),
    ).resolves.toBe(authResponse);

    expect(provider.verifySms).toHaveBeenCalledWith("+919876543210", "123456");
    expect(login.executeVerifiedPhone).toHaveBeenCalledWith(
      "+919876543210",
      device,
      metadata,
    );
  });

  it("creates an OTP-only account with an unguessable internal password", async () => {
    const { service, redis, signup } = build();
    redis.get.mockResolvedValue(
      JSON.stringify({
        purpose: "SIGNUP",
        requestedAt: new Date().toISOString(),
      }),
    );

    await service.verify(
      { phone: "+919876543210", purpose: "SIGNUP", code: "123456", device },
      metadata,
    );

    expect(signup.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+919876543210",
        device,
        password: expect.stringMatching(/^[A-Za-z0-9_-]{40,}$/),
      }),
      metadata,
      "otp",
    );
  });

  it("rejects a code requested for a different purpose", async () => {
    const { service, redis, provider } = build();
    redis.get.mockResolvedValue(
      JSON.stringify({
        purpose: "SIGNUP",
        requestedAt: new Date().toISOString(),
      }),
    );

    await expect(
      service.verify(
        { phone: "+919876543210", purpose: "LOGIN", code: "123456", device },
        metadata,
      ),
    ).rejects.toBeInstanceOf(AppException);
    expect(provider.verifySms).not.toHaveBeenCalled();
  });
});
