import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { blindApi } from "../../api/endpoints/blind";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
export function BlindEntry({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const router = useRouter(); const { palette } = useTheme();
  useFocusEffect(useCallback(() => { let active = true; void blindApi.capabilities().then(value => { if (active) setEnabled(value.enabled); }).catch(() => { if (active) setEnabled(false); }); return () => { active = false; }; }, []));
  if (!enabled) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Blind Vibe, Thursday introductions" onPress={() => router.push({ pathname: "/(app)/blind/[occurrenceId]", params: { occurrenceId: "current" } })} style={{ flex: compact ? 1 : undefined, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 56, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}>
    <Icon name="eyeOff" size={22} color={palette.brand} />
    <View style={{ flex: 1, minWidth: 0 }}><Text variant={compact ? "captionStrong" : "bodyStrong"}>Blind Vibe</Text><Text variant="caption" color="textSubdued">{compact ? "Thursday" : "Thursday · conversation first"}</Text></View>
    {!compact ? <Icon name="chevronRight" size={18} color={palette.textMuted} /> : null}
  </Pressable>;
}
