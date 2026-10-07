import { AppException } from "../../../common/errors/app.exception";
import { OtpProviderService } from "./otp-provider.service";

const config = (provider: "disabled" | "twilio" | "msg91") => ({
  provider,
  challengeTtlSeconds: 600,
  resendCooldownSeconds: 30,
  maxVerifyAttempts: 5,
  requestTimeoutMs: 1_000,
  twilio: {
    accountSid: "AC11111111111111111111111111111111",
    authToken: "twilio-secret-token-value",
    verifyServiceSid: "VA22222222222222222222222222222222",
  },
  msg91: {
    authKey: "msg91-auth-key-value",
    templateId: "template-1",
  },
});

describe("OtpProviderService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends and verifies a Twilio Verify code using E.164 input", async () => {
    const request = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "approved" }), { status: 200 }),
      );
    const service = new OtpProviderService(config("twilio") as never);

    await service.sendSms("+919876543210");
    await expect(service.verifySms("+919876543210", "123456")).resolves.toBe(
      true,
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/Verifications"),
      expect.objectContaining({ method: "POST" }),
    );
    const sendBody = (request.mock.calls[0]?.[1] as RequestInit)
      .body as URLSearchParams;
    expect(sendBody.get("To")).toBe("+919876543210");
    expect(sendBody.get("Channel")).toBe("sms");
    const verifyBody = (request.mock.calls[1]?.[1] as RequestInit)
      .body as URLSearchParams;
    expect(verifyBody.get("Code")).toBe("123456");
  });

  it("maps a rejected Twilio verification to false", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const service = new OtpProviderService(config("twilio") as never);

    await expect(service.verifySms("+919876543210", "000000")).resolves.toBe(
      false,
    );
  });

  it("uses the MSG91 send and verify endpoints without a leading plus", async () => {
    const request = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ type: "success", message: "OTP sent" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ type: "success", message: "OTP verified" }),
          {
            status: 200,
          },
        ),
      );
    const service = new OtpProviderService(config("msg91") as never);

    await service.sendSms("+919876543210");
    await expect(service.verifySms("+919876543210", "123456")).resolves.toBe(
      true,
    );

    expect(request.mock.calls[0]?.[0]).toContain("mobile=919876543210");
    expect(request.mock.calls[1]?.[0]).toContain("otp=123456");
  });

  it("fails closed while no real provider is configured", async () => {
    const service = new OtpProviderService(config("disabled") as never);
    await expect(service.sendSms("+919876543210")).rejects.toBeInstanceOf(
      AppException,
    );
  });
});
