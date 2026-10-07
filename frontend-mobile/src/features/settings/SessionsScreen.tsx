import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { sessionsApi } from "../../api/endpoints/sessions";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { Header } from "../../components/layout/Header";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { SessionDto } from "../../types/auth";
import { buildDeviceContext } from "../../utils/device";
import { formatRelativeTime } from "../../utils/format";
import { SettingsLoadState } from "./SettingsLoadState";

const platformLabel = (platform: SessionDto["platform"]): string =>
  ({ ANDROID: "Android", IOS: "iOS", WEB: "Web", UNKNOWN: "Unknown" })[platform];

export const SessionsScreen: React.FC = () => {
  const formLayout = useProfileFormLayout();
  const goBack = useSafeBack("/(app)/settings");
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useStyles();
  const [items, setItems] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mutationBusyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [page, currentDevice] = await Promise.all([
        sessionsApi.list({ limit: 50 }),
        buildDeviceContext(),
      ]);
      setItems(
        page.items.map((session) =>
          session.isCurrent
            ? {
                ...session,
                deviceId: currentDevice.deviceId ?? session.deviceId,
                deviceName: currentDevice.deviceName ?? session.deviceName,
                platform: currentDevice.platform,
                appVersion: currentDevice.appVersion ?? session.appVersion,
              }
            : session,
        ),
      );
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (session: SessionDto) => {
    if (mutationBusyRef.current || session.isCurrent) return;
    mutationBusyRef.current = true;
    setBusyId(session.id);
    try {
      await sessionsApi.revoke(session.id);
      setItems((current) => current.filter((item) => item.id !== session.id));
      toast.show("Device signed out", "success");
    } catch {
      toast.show("Couldn’t sign out that device.", "error");
    } finally {
      mutationBusyRef.current = false;
      setBusyId(null);
    }
  };

  const confirmRevoke = (session: SessionDto) => {
    Alert.alert(
      "Sign out this device?",
      `${session.deviceName ?? platformLabel(session.platform)} will need to sign in again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void revoke(session),
        },
      ],
    );
  };

  const revokeAll = async () => {
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    setBusyId("all");
    try {
      const response = await sessionsApi.revokeOthers();
      setItems((current) => current.filter((session) => session.isCurrent));
      toast.show(
        response.revokedCount === 1
          ? "1 other device signed out"
          : `${response.revokedCount} other devices signed out`,
        "success",
      );
    } catch {
      toast.show("Couldn’t sign out other devices.", "error");
    } finally {
      mutationBusyRef.current = false;
      setBusyId(null);
    }
  };

  const confirmRevokeAll = () => {
    Alert.alert(
      "Sign out all other devices?",
      "Every other Yariva session will need to sign in again. This device stays signed in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out devices",
          style: "destructive",
          onPress: () => void revokeAll(),
        },
      ],
    );
  };

  const hasOtherSessions = items.some((session) => !session.isCurrent);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header showBack onLeftPress={goBack} title="Devices & sessions" />
        {loading || loadError ? (
          <SettingsLoadState loading={loading} error={loadError} onRetry={() => void load()} />
        ) : (
          <ScrollView
            contentContainerStyle={formLayout.content}
            contentInsetAdjustmentBehavior="automatic"
          >
            <Text variant="caption" color="textSubdued" style={{ marginBottom: 12 }}>
              Review devices with access to your account. Sign out anything you do not recognise.
            </Text>
            <View style={styles.list}>
              {items.map((session, index) => {
                const rowBusy = busyId === session.id;
                const label = session.deviceName ?? `${platformLabel(session.platform)} device`;
                return (
                  <View
                    key={session.id}
                    style={[styles.row, index !== items.length - 1 && styles.rowBorder]}
                  >
                    <View style={styles.iconBubble}>
                      <Icon
                        name={session.platform === "WEB" ? "globe" : "device"}
                        size={18}
                        color={palette.brandStrong}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {label}
                      </Text>
                      <Text variant="micro" color="textSubdued" style={{ marginTop: 2 }}>
                        {platformLabel(session.platform)}
                        {session.appVersion ? ` · v${session.appVersion}` : ""} · seen{" "}
                        {formatRelativeTime(session.lastSeenAt)}
                      </Text>
                    </View>
                    {session.isCurrent ? (
                      <Badge tone="success" label="THIS DEVICE" />
                    ) : (
                      <Pressable
                        onPress={() => confirmRevoke(session)}
                        disabled={busyId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Sign out ${label}`}
                        accessibilityState={{ disabled: busyId !== null, busy: rowBusy }}
                        style={({ pressed }) => ({
                          minHeight: 44,
                          justifyContent: "center",
                          opacity: busyId !== null ? 0.45 : pressed ? 0.72 : 1,
                        })}
                      >
                        <Text variant="captionStrong" color="error">
                          {rowBusy ? "Signing out…" : "Sign out"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
            {hasOtherSessions ? (
              <Button
                label="Sign out all other devices"
                variant="ghost"
                onPress={confirmRevokeAll}
                loading={busyId === "all"}
                disabled={busyId !== null}
                fullWidth
                style={{ marginTop: 18 }}
              />
            ) : (
              <Text variant="caption" color="textSubdued" align="center" style={{ marginTop: 18 }}>
                No other signed-in devices.
              </Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  list: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 58,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.brandSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
}));
