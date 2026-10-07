import { describe, expect, it } from "vitest";
import {
  isLikelyInternationalPhone,
  isValidOtpCode,
  maskPhone,
  normalizeOtpInput,
} from "./otpLogic";

describe("OTP form logic", () => {
  it("keeps only the supported OTP digits", () => {
    expect(normalizeOtpInput("12 34-56abc")).toBe("123456");
    expect(normalizeOtpInput("123456789012")).toBe("1234567890");
  });

  it("requires a 4 to 10 digit code", () => {
    expect(isValidOtpCode("1234")).toBe(true);
    expect(isValidOtpCode("1234567890")).toBe(true);
    expect(isValidOtpCode("123")).toBe(false);
    expect(isValidOtpCode("12ab56")).toBe(false);
  });

  it("requires an international phone number with a country code", () => {
    expect(isLikelyInternationalPhone("+91 98765 43210")).toBe(true);
    expect(isLikelyInternationalPhone("9876543210")).toBe(false);
  });

  it("masks the middle of the phone number", () => {
    expect(maskPhone("+91 98765 43210")).toBe("+91••••3210");
  });
});
