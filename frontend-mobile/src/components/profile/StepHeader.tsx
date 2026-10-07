import React from "react";
import { View } from "react-native";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Text } from "../ui/Text";
import { Header } from "../layout/Header";

// StepHeader mirrors aroha_ui_deisgn_files/profile-setup.jsx — circular back
// IconBtn left, "STEP X OF Y" micro caption right, gradient progress bar,
// then the shared Space Grotesk title with optional subtitle.
interface StepHeaderProps {
  step?: number;
  total?: number;
  contextLabel?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export const StepHeader: React.FC<StepHeaderProps> = ({
  step,
  total,
  contextLabel,
  title,
  subtitle,
  onBack,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const showProgress = step != null && total != null && total > 0;
  const pct = showProgress ? Math.max(0, Math.min(1, step / total)) : 0;
  if (contextLabel === "EDIT PROFILE")
    return <Header title={title} showBack onLeftPress={onBack} />;
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {onBack ? (
          <IconButton onPress={onBack} accessibilityLabel="Back">
            <Icon name="arrowLeft" size={22} />
          </IconButton>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text variant="micro" color="textSubdued" style={{ letterSpacing: 0.6 }}>
          {contextLabel ?? (showProgress ? `STEP ${step} OF ${total}` : "PROFILE")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {showProgress ? (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct * 100}%`, backgroundColor: palette.brand },
            ]}
          />
        </View>
      ) : null}

      <Text variant="title" style={{ marginTop: showProgress ? 22 : 8 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textSubdued" style={{ marginTop: 8, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  wrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  progressTrack: {
    height: 4,
    backgroundColor: palette.brandTint,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
  },
}));
