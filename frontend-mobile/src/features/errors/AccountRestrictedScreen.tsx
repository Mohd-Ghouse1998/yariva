import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { ArohaMark } from "../../components/ui/ArohaMark";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { UserStatus } from "../../types/enums";

// Mirrors aroha_ui_deisgn_files/profile-settings.jsx > ScreenRestricted.
const TITLE: Record<Exclude<UserStatus, "ACTIVE">, string> = {
  RESTRICTED: "Your account is paused",
  SUSPENDED: "Your account is suspended",
  BANNED: "Your account is permanently disabled",
  DELETED: "Account deleted",
};
const BODY: Record<Exclude<UserStatus, "ACTIVE">, string> = {
  RESTRICTED:
    "We’re reviewing a recent report. Discovery, chat, and calls are temporarily off. We’ll get back to you within 24 hours.",
  SUSPENDED: "Your account is suspended while our moderation team reviews recent activity.",
  BANNED: "Yariva is no longer available to this account due to community guideline violations.",
  DELETED: "This account has been deleted and is no longer accessible.",
};

interface Props {
  status: UserStatus;
}

export const AccountRestrictedScreen: React.FC<Props> = ({ status }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const { logout } = useAuth();
  const key = status as Exclude<UserStatus, "ACTIVE">;
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.wrap}>
        <ArohaMark size={36} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <Icon name="shield" size={36} color={palette.warning} strokeWidth={1.6} />
          </View>
          <Text variant="title" align="center">
            {TITLE[key]}
          </Text>
          <Text
            variant="body"
            color="textSubdued"
            align="center"
            style={{ lineHeight: 22, maxWidth: 300 }}
          >
            {BODY[key]}
          </Text>
          {key === "RESTRICTED" ? (
            <View style={styles.pillCol}>
              {["Discovery", "Chat", "Calls"].map((label) => (
                <View key={label} style={styles.pausedPill}>
                  <Icon name="lock" size={14} color={palette.warning} />
                  <Text variant="captionStrong" style={{ color: palette.warning, fontSize: 13 }}>
                    {label} paused
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <Button
          label={key === "DELETED" ? "Sign out" : "Contact support"}
          variant={key === "DELETED" ? "danger" : "secondary"}
          fullWidth
          onPress={() => void logout()}
        />
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  wrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.warningSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
  pillCol: {
    gap: 6,
    marginTop: 6,
    alignItems: "center",
  },
  pausedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: palette.warningSubdued,
    minWidth: 220,
    justifyContent: "center",
  },
}));
