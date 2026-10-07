import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { safetyApi } from "../../api/endpoints/safety";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { Header } from "../../components/layout/Header";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { BlockedUserDto } from "../../types/safety";

// Mirrors aroha_ui_deisgn_files/profile-settings.jsx > ScreenBlocked.
export const BlockedUsersScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const formLayout = useProfileFormLayout();
  const goBack = useSafeBack("/(app)/settings");
  const toast = useToast();
  const [items, setItems] = useState<BlockedUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await safetyApi.blocks({ limit: 100 });
      setItems(page.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (id: string) => {
    if (unblocking) return;
    setUnblocking(true);
    try {
      await safetyApi.unblock(id);
      setItems((prev) => prev.filter((b) => b.blockedId !== id));
      toast.show("Unblocked", "success");
      setConfirmId(null);
    } catch {
      toast.show("Couldn’t unblock.", "error");
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header title="Blocked" showBack onLeftPress={goBack} />
        {loading ? (
          <Text variant="body" color="textSubdued" style={{ padding: 20 }}>
            Loading…
          </Text>
        ) : error ? (
          <View style={formLayout.content}>
            <Text color="error">Couldn’t load blocked people.</Text>
            <Button label="Retry" onPress={() => void load()} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            title="No one is blocked"
            body="Blocked people can’t see your profile, message, or call you."
          />
        ) : (
          <ScrollView contentContainerStyle={formLayout.content}>
            {items.map((b) => (
              <View key={b.id} style={styles.row}>
                <Avatar size={32} initials={b.blockedId.slice(0, 2)} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={{ fontSize: 14, fontWeight: "500" }}>
                    User · {b.blockedId.slice(0, 8)}
                  </Text>
                  {b.reason ? (
                    <Text variant="caption" color="textSubdued">
                      {b.reason}
                    </Text>
                  ) : null}
                </View>
                <Button
                  label="Unblock"
                  variant="secondary"
                  size="sm"
                  onPress={() => setConfirmId(b.blockedId)}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
      <CenterDialog
        visible={confirmId !== null}
        onClose={() => {
          if (!unblocking) setConfirmId(null);
        }}
        accessibilityLabel="Unblock person"
      >
        <Text variant="subheading">Unblock this person?</Text>
        <Text color="textSubdued">They can discover and contact you again.</Text>
        <Button
          label="Unblock"
          loading={unblocking}
          onPress={() => {
            if (confirmId) void unblock(confirmId);
          }}
        />
        <Button
          label="Cancel"
          variant="ghost"
          disabled={unblocking}
          onPress={() => setConfirmId(null)}
        />
      </CenterDialog>
    </View>
  );
};

const useStyles = createThemeStyleHook(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
}));
