import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { authApi } from "../../api/endpoints/auth";
import { ApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { YarivaWordmark } from "../../components/ui/YarivaBrand";
import type { OtpPurpose } from "../../types/auth";
import { AgeTermsConsent } from "./AgeTermsConsent";
import { AuthScreen } from "./AuthScreen";
import {
  isLikelyInternationalPhone,
  isValidOtpCode,
  maskPhone,
  normalizeOtpInput,
} from "./otpLogic";
import { useOtpCapabilities } from "./useOtpCapabilities";

type OtpStep = "phone" | "code";

export const OtpAuthScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const purpose: OtpPurpose = params.mode === "signup" ? "SIGNUP" : "LOGIN";
  const isSignup = purpose === "SIGNUP";
  const passwordRoute = isSignup ? "/(auth)/signup" : "/(auth)/login";
  const availability = useOtpCapabilities();
  const { verifyOtp } = useAuth();

  const [step, setStep] = useState<OtpStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestCode = async () => {
    if (!isLikelyInternationalPhone(phone)) {
      setError("Enter your mobile number with country code, for example +91.");
      return;
    }
    if (isSignup && !agreed) {
      setConsentError("You need to agree to continue");
      return;
    }
    setRequesting(true);
    setError(null);
    setConsentError(null);
    try {
      const response = await authApi.requestOtp({ phone: phone.trim(), purpose });
      setCooldown(response.resendAfterSeconds);
      setCode("");
      setStep("code");
    } catch (cause) {
      setError(otpErrorMessage(cause, "request"));
    } finally {
      setRequesting(false);
    }
  };

  const submitCode = async () => {
    if (!isValidOtpCode(code)) {
      setError("Enter the code from the SMS.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await verifyOtp({ phone: phone.trim(), code, purpose });
      router.replace(isSignup ? "/(onboarding)" : "/");
    } catch (cause) {
      setError(otpErrorMessage(cause, "verify"));
    } finally {
      setVerifying(false);
    }
  };

  const goBack = () => {
    if (step === "code") {
      setStep("phone");
      setCode("");
      setError(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(passwordRoute);
  };

  if (availability !== "enabled") {
    const checking = availability === "loading";
    return (
      <AuthScreen
        onBack={goBack}
        footer={
          <View style={{ gap: 8 }}>
            {checking ? <Button label="Checking OTP availability" loading fullWidth /> : null}
            <Button
              label="Use password instead"
              variant={checking ? "ghost" : "primary"}
              onPress={() => router.replace(passwordRoute)}
              fullWidth
            />
          </View>
        }
      >
        <View style={{ alignItems: "center" }}>
          <YarivaWordmark size={48} />
        </View>
        <Text
          variant="authTitle"
          align="center"
          accessibilityRole="header"
          style={{ marginTop: 20 }}
        >
          {checking ? "Checking phone OTP" : "Phone OTP unavailable"}
        </Text>
        <View style={{ alignItems: "center", marginTop: 18 }}>
          {checking ? <ActivityIndicator /> : null}
          <Text variant="body" color="textSubdued" align="center" style={{ marginTop: 10 }}>
            {checking
              ? "Confirming secure SMS verification with Yariva…"
              : "Secure SMS verification isn’t configured right now. You can still continue with your password."}
          </Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      onBack={goBack}
      footer={
        step === "phone" ? (
          <View style={{ gap: 8 }}>
            <Button
              label="Send verification code"
              onPress={() => void requestCode()}
              loading={requesting}
              disabled={!isLikelyInternationalPhone(phone) || (isSignup && !agreed)}
              fullWidth
            />
            <Button
              label="Use password instead"
              variant="ghost"
              onPress={() => router.replace(passwordRoute)}
              fullWidth
            />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Button
              label={isSignup ? "Verify and create account" : "Verify and sign in"}
              onPress={() => void submitCode()}
              loading={verifying}
              disabled={!isValidOtpCode(code)}
              fullWidth
            />
            <Button
              label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              variant="secondary"
              onPress={() => void requestCode()}
              loading={requesting}
              disabled={cooldown > 0}
              fullWidth
            />
            <Button label="Change mobile number" variant="ghost" onPress={goBack} fullWidth />
          </View>
        )
      }
    >
      <View style={{ alignItems: "center" }}>
        <YarivaWordmark size={48} />
      </View>
      <Text variant="authTitle" align="center" accessibilityRole="header" style={{ marginTop: 20 }}>
        {isSignup ? "Create account with OTP" : "Sign in with OTP"}
      </Text>
      <Text variant="body" color="textSubdued" align="center" style={{ marginTop: 8 }}>
        {step === "phone"
          ? "We’ll text a one-time verification code to your mobile number."
          : `Enter the code sent to ${maskPhone(phone)}.`}
      </Text>

      <View style={{ marginTop: 28, gap: 16 }}>
        {step === "phone" ? (
          <>
            <Input
              label="Mobile number"
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={setPhone}
              maxLength={32}
              editable={!requesting}
              helper="Include your country code. SMS charges may apply."
            />
            {isSignup ? (
              <AgeTermsConsent
                checked={agreed}
                onChange={setAgreed}
                error={consentError}
                disabled={requesting}
              />
            ) : null}
          </>
        ) : (
          <Input
            label="Verification code"
            placeholder="Enter code"
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            value={code}
            onChangeText={(value) => setCode(normalizeOtpInput(value))}
            editable={!verifying}
            maxLength={10}
            onSubmitEditing={() => void submitCode()}
          />
        )}
      </View>

      {error ? (
        <Text
          variant="caption"
          color="error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ marginTop: 12 }}
        >
          {error}
        </Text>
      ) : null}
    </AuthScreen>
  );
};

function otpErrorMessage(error: unknown, stage: "request" | "verify"): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "AUTH_OTP_COOLDOWN":
      return "Please wait before requesting another code.";
    case "AUTH_OTP_INVALID":
      return "That code is incorrect or expired. Request a new code and try again.";
    case "AUTH_OTP_ACCOUNT_NOT_FOUND":
      return "No Yariva account uses this mobile number. Create an account with OTP instead.";
    case "AUTH_IDENTIFIER_TAKEN":
      return "A Yariva account already uses this mobile number. Sign in with OTP instead.";
    case "AUTH_OTP_UNAVAILABLE":
      return "Secure SMS verification is temporarily unavailable. Use your password or try later.";
    default:
      if (error.isAccountRestricted()) return "Your account isn’t available right now.";
      return stage === "request" ? "We couldn’t send a code. Please try again." : error.message;
  }
}
