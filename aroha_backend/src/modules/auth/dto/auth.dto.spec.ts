import "reflect-metadata";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { LoginDto, SignupDto, VerifyOtpDto } from "./auth.dto";

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
});

describe.each([
  [LoginDto, { identifier: "person@example.test", password: "StrongPassw0rd!" }],
  [SignupDto, { email: "person@example.test", password: "StrongPassw0rd!" }],
  [VerifyOtpDto, { phone: "+919000000001", purpose: "LOGIN", code: "123456" }],
] as const)("%p device validation", (metatype, fields) => {
  it.each([undefined, null, [], [{ platform: "ANDROID" }], "ANDROID", {}, { platform: "INVALID" }])(
    "rejects a missing or malformed device: %p",
    async (device) => {
      await expect(pipe.transform({ ...fields, device }, { type: "body", metatype }))
        .rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it("accepts the existing mobile device contract", async () => {
    const device = { platform: "ANDROID", deviceId: null, deviceName: "Test phone", appVersion: "0.3.0" };
    await expect(pipe.transform({ ...fields, device }, { type: "body", metatype }))
      .resolves.toMatchObject({ ...fields, device });
  });
});
