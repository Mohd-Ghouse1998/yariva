import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { PetalBackdrop } from "../../components/ui/PetalBackdrop";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { AuthScreen, useAuthKeyboardVisible } from "./AuthScreen";
import { useResponsiveLayout } from "../../theme/responsive";
import { AgeTermsConsent } from "./AgeTermsConsent";
import { useOtpCapabilities } from "./useOtpCapabilities";
import { PASSWORD_MAX_LENGTH, signupPasswordError } from "./authValidation";

// Portrait-led artwork; headings, petals, and functional controls remain native and accessible.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const signupHero = require("../../../assets/brand/auth-signup-hero-v2.png");

const SignupIntroduction: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shortViewport, accessibilityLayout } = useResponsiveLayout();
  const { height } = useWindowDimensions();
  const keyboardVisible = useAuthKeyboardVisible();
  const { palette } = useTheme();
  const compact = shortViewport || accessibilityLayout;

  return (
    <View>
      {!keyboardVisible ? (
        <ImageBackground
          source={signupHero}
          resizeMode="cover"
          imageStyle={styles.heroImage}
          style={[styles.hero, { minHeight: compact ? 220 : Math.min(390, Math.max(300, height * 0.43)) }]}
          accessible={false}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[palette.authHeroWashStart, palette.authHeroWashMid, palette.authHeroWashEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.85, y: 0.5 }}
            style={styles.heroWash}
          />
          <PetalBackdrop variant="authHero" />
          <Text variant="photoHeadline" color="alwaysInk" style={styles.heroTitle}>
            Real people.{"\n"}Meaningful{"\n"}connections.
          </Text>
        </ImageBackground>
      ) : null}
      <View
        style={[
          styles.formPanel,
          {
            backgroundColor: palette.surface,
            marginTop: keyboardVisible || compact ? 0 : -spacing.xxxl,
          },
        ]}
      >
        <Text variant="authTitle" accessibilityRole="header">
          Create your account
        </Text>
        {children}
      </View>
    </View>
  );
};

/** Account creation keeps the existing validated backend signup contract. */
export const SignupScreen: React.FC = () => {
  const router = useRouter();
  const { signup } = useAuth();
  const toast = useToast();
  const { palette } = useTheme();
  const otpAvailability = useOtpCapabilities();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
    agreed?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      next.email = "That doesn’t look like an email";
    const passwordError = signupPasswordError(password);
    if (passwordError) next.password = passwordError;
    if (!agreed) next.agreed = "You need to agree to continue";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await signup({ email: email.trim().toLowerCase(), password });
      router.replace("/(onboarding)");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "AUTH_IDENTIFIER_TAKEN") {
          setErrors({ email: "An account already exists with that email" });
        } else if (err.code === "AUTH_PASSWORD_WEAK") {
          setErrors({ password: "Choose a stronger password" });
        } else {
          setErrors({ general: err.message });
        }
      } else {
        toast.show("Something went wrong. Please try again.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canBack = router.canGoBack();

  return (
    <AuthScreen
      onBack={canBack ? () => router.back() : () => router.replace("/(auth)/login")}
      contentAlign="top"
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Continue"
            onPress={onSubmit}
            loading={submitting}
            disabled={!email.trim() || !password || !agreed}
            fullWidth
          />
          {otpAvailability === "enabled" ? (
            <Button
              label="Sign up with phone OTP"
              variant="secondary"
              onPress={() => router.push({ pathname: "/(auth)/otp", params: { mode: "signup" } })}
              fullWidth
            />
          ) : null}
          <Button
            label="Sign in instead"
            variant="ghost"
            onPress={() => router.replace("/(auth)/login")}
            fullWidth
          />
        </View>
      }
    >
      <SignupIntroduction>
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <Input
            label="Email"
            placeholder="you@example.com"
            leftIcon={<Icon name="mail" size={18} color={palette.textSubdued} />}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
            error={errors.email}
          />
          <Input
            label="Password"
            placeholder="Create a password"
            leftIcon={<Icon name="lock" size={18} color={palette.textSubdued} />}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
            maxLength={PASSWORD_MAX_LENGTH}
            error={errors.password}
            rightIcon={
              <Pressable
                onPress={() => setShowPassword((visible) => !visible)}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityState={{ selected: showPassword }}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={18} color={palette.textSubdued} />
              </Pressable>
            }
          />

          <AgeTermsConsent
            checked={agreed}
            onChange={setAgreed}
            error={errors.agreed}
            disabled={submitting}
          />
        </View>

        {errors.general ? (
          <Text
            variant="caption"
            color="error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ marginTop: spacing.md }}
          >
            {errors.general}
          </Text>
        ) : null}
      </SignupIntroduction>
    </AuthScreen>
  );
};

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    justifyContent: "center",
  },
  heroImage: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  heroWash: StyleSheet.absoluteFill,
  heroTitle: {
    maxWidth: "60%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  formPanel: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
});
