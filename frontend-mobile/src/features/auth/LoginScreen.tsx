import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { ApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/spacing";
import { AuthBrandHeader } from "./AuthBrandHeader";
import { AuthScreen } from "./AuthScreen";
import { useOtpCapabilities } from "./useOtpCapabilities";
import { PASSWORD_MAX_LENGTH } from "./authValidation";

/** mobile_app_v3's card-free password sign-in adapted to Yariva's petal identity. */
export const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const { palette } = useTheme();
  const otpAvailability = useOtpCapabilities();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!identifier.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login({ identifier: identifier.trim(), password });
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "AUTH_INVALID_CREDENTIALS") {
          setError("Email or password isn’t right.");
        } else if (err.isAccountRestricted()) {
          setError("Your account isn’t available right now. Contact support.");
        } else {
          setError(err.message);
        }
      } else {
        toast.show("Something went wrong. Please try again.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canBack = router.canGoBack();
  const loginButton = (
    <Button
      label="Log in"
      onPress={onSubmit}
      loading={submitting}
      disabled={!identifier.trim() || !password}
      fullWidth
    />
  );

  return (
    <AuthScreen
      onBack={canBack ? () => router.back() : undefined}
      keyboardFooter={loginButton}
      footer={
        <View style={{ gap: spacing.sm }}>
          {loginButton}
          {otpAvailability === "enabled" ? (
            <Button
              label="Sign in with phone OTP"
              variant="secondary"
              onPress={() => router.push({ pathname: "/(auth)/otp", params: { mode: "login" } })}
              fullWidth
            />
          ) : null}
          <Button
            label="Create an account"
            variant="ghost"
            onPress={() => router.replace("/(auth)/signup")}
            fullWidth
          />
        </View>
      }
    >
      <AuthBrandHeader />

      <View style={{ marginTop: spacing.xxxl, gap: spacing.md }}>
        <Input
          accessibilityLabel="Mobile number or email"
          placeholder="Email or phone number"
          leftIcon={<Icon name="mail" size={18} color={palette.textSubdued} />}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          value={identifier}
          onChangeText={setIdentifier}
          editable={!submitting}
        />
        <Input
          accessibilityLabel="Password"
          placeholder="Password"
          leftIcon={<Icon name="lock" size={18} color={palette.textSubdued} />}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          maxLength={PASSWORD_MAX_LENGTH}
          onSubmitEditing={() => void onSubmit()}
          returnKeyType="done"
          rightIcon={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityState={{ selected: showPassword }}
              onPress={() => setShowPassword((visible) => !visible)}
              hitSlop={16}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={18} color={palette.textSubdued} />
            </Pressable>
          }
        />
      </View>

      {error ? (
        <Text
          variant="caption"
          color="error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ marginTop: spacing.md }}
        >
          {error}
        </Text>
      ) : null}
    </AuthScreen>
  );
};
