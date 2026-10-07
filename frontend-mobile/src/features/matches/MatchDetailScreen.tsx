import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { matchesApi } from "../../api/endpoints/matches";
import { VerificationBadge } from "../../components/dating";
import { Header } from "../../components/layout/Header";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Icon, type IconName } from "../../components/ui/Icon";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { Skeleton } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { layout, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { MatchDetailDto } from "../../types/match";
import { useCallManager } from "../calls/CallManager";

export const MatchDetailScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/connections");
  const toast = useToast();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = params.matchId;
  const callManager = useCallManager();
  const [match, setMatch] = useState<MatchDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      setMatch(await matchesApi.get(matchId));
    } catch {
      toast.show("Couldn’t load match.", "error");
    } finally {
      setLoading(false);
    }
  }, [matchId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSetting = async (
    patch: Partial<{ allowVoiceCalls: boolean; allowVideoCalls: boolean; muted: boolean }>,
  ) => {
    if (!match) return;
    try {
      const response = await matchesApi.setMyCommunication(match.id, {
        allowVoiceCalls: patch.allowVoiceCalls ?? match.myCommunicationSetting.allowVoiceCalls,
        allowVideoCalls: patch.allowVideoCalls ?? match.myCommunicationSetting.allowVideoCalls,
        muted: patch.muted ?? match.myCommunicationSetting.muted,
      });
      setMatch({ ...match, myCommunicationSetting: response.setting });
    } catch {
      toast.show("Couldn’t update.", "error");
    }
  };

  const startCall = async (callType: "VOICE" | "VIDEO") => {
    if (!match) return;
    try {
      await callManager.startOutgoingCall({ matchId: match.id, callType });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Couldn’t start call.", "error");
    }
  };

  const unmatch = async () => {
    if (!match) return;
    setBusy(true);
    try {
      await matchesApi.end(match.id);
      goBack();
    } catch {
      toast.show("Couldn’t end match.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !match) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
          <Header showBack onLeftPress={goBack} title="Connection" />
          <View style={styles.loading}>
            <View style={styles.loadingIdentity}>
              <Skeleton width={72} height={72} borderRadius={36} />
              <View style={styles.loadingCopy}>
                <Skeleton width="55%" height={20} />
                <Skeleton width="80%" height={14} />
              </View>
            </View>
            <Skeleton height={60} borderRadius={14} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const other = match.otherUser;
  const setting = match.myCommunicationSetting;
  const photo = other.photos.find((item) => item.isPrimary)?.url ?? other.photos[0]?.url;
  const voiceEnabled =
    setting.allowVoiceCalls && match.otherUserCommunicationAllowed.allowVoiceCalls;
  const videoEnabled =
    setting.allowVideoCalls && match.otherUserCommunicationAllowed.allowVideoCalls;
  const openProfile = () =>
    router.push({
      pathname: "/(app)/profile/[userId]",
      params: {
        userId: other.userId,
        profileMode: "MATCH",
        ...(match.conversationId ? { conversationId: match.conversationId } : {}),
      },
    });

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
        <Header showBack onLeftPress={goBack} title="Connection" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${other.displayName}'s profile`}
            onPress={openProfile}
            style={({ pressed }) => [styles.identity, pressed ? styles.pressed : null]}
          >
            <Avatar uri={photo} initials={other.displayName} size={72} />
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text variant="heading" numberOfLines={1} style={styles.flex}>
                  {other.displayName}
                  {other.age === null ? "" : `, ${other.age}`}
                </Text>
                <VerificationBadge status={other.verificationStatus} compact />
              </View>
              <Text variant="caption" color="textSubdued" numberOfLines={2}>
                {other.headline ?? "Your Yariva connection"}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={palette.textSubdued} />
          </Pressable>

          <Card padded={false} style={styles.quickActions}>
            <QuickAction
              icon="chat"
              label="Message"
              onPress={() =>
                match.conversationId
                  ? router.push({
                      pathname: "/(app)/conversation/[conversationId]",
                      params: { conversationId: match.conversationId },
                    })
                  : toast.show("Conversation not ready yet.", "info")
              }
            />
            <QuickAction
              divider
              icon="phone"
              label="Voice"
              disabled={!voiceEnabled}
              onPress={() => void startCall("VOICE")}
            />
            <QuickAction
              divider
              icon="video"
              label="Video"
              disabled={!videoEnabled}
              onPress={() => void startCall("VIDEO")}
            />
          </Card>

          <Button
            label="Plan meetup"
            fullWidth
            leftIcon={<Icon name="calendar" size={17} color={palette.textOnBrand} />}
            onPress={() =>
              router.push({ pathname: "/(app)/date-plan/new", params: { matchId: match.id } })
            }
          />

          <NavigationListSection>
            <NavigationListRow
              first
              icon="settings"
              label="Call & notification settings"
              onPress={() => setPreferencesOpen(true)}
            />
          </NavigationListSection>

          <NavigationListSection label="SAFETY & PRIVACY">
            <NavigationListRow
              first
              icon="block"
              label="Unmatch"
              meta="Ends this connection"
              danger
              disabled={busy}
              onPress={() =>
                Alert.alert("Unmatch?", `Your connection with ${other.displayName} will end.`, [
                  { text: "Keep match", style: "cancel" },
                  { text: "Unmatch", style: "destructive", onPress: () => void unmatch() },
                ])
              }
            />
            <NavigationListRow
              icon="flag"
              label="Report"
              meta="Tell Yariva about a safety concern"
              danger
              onPress={() =>
                router.push({
                  pathname: "/(app)/report",
                  params: {
                    targetType: "USER",
                    targetId: other.userId,
                    reportedUserId: other.userId,
                  },
                })
              }
            />
          </NavigationListSection>
        </ScrollView>

        <CenterDialog
          visible={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
          accessibilityLabel="Call and notification settings"
        >
          <View style={styles.dialogContent}>
            <Text variant="titleSm">Call & notifications</Text>
            <Card padded={false} style={styles.dialogSettings}>
              <ToggleRow
                label="Allow voice calls"
                value={setting.allowVoiceCalls}
                onValueChange={(value) => void updateSetting({ allowVoiceCalls: value })}
                style={styles.firstToggle}
              />
              <ToggleRow
                label="Allow video calls"
                value={setting.allowVideoCalls}
                onValueChange={(value) => void updateSetting({ allowVideoCalls: value })}
                style={styles.groupedToggle}
              />
              <ToggleRow
                label="Mute notifications"
                value={setting.muted}
                onValueChange={(value) => void updateSetting({ muted: value })}
                style={styles.groupedToggle}
              />
            </Card>
            <Button
              label="Done"
              variant="ghost"
              fullWidth
              onPress={() => setPreferencesOpen(false)}
            />
          </View>
        </CenterDialog>
      </SafeAreaView>
    </View>
  );
};

const QuickAction: React.FC<{
  icon: IconName;
  label: string;
  disabled?: boolean;
  divider?: boolean;
  onPress: () => void;
}> = ({ icon, label, disabled = false, divider = false, onPress }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        divider ? styles.quickDivider : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon name={icon} filled size={18} color={disabled ? palette.textMuted : palette.textBrand} />
      <Text variant="captionStrong" color={disabled ? "textMuted" : "textPrimary"}>
        {label}
      </Text>
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    gap: spacing.lg,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.huge,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identityCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  flex: { flex: 1, minWidth: 0 },
  quickActions: { flexDirection: "row", overflow: "hidden" },
  quickAction: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  quickDivider: { borderLeftWidth: 1, borderLeftColor: palette.divider },
  groupedToggle: {
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: palette.divider,
    borderRadius: 0,
  },
  firstToggle: { borderWidth: 0, borderRadius: 0 },
  dialogContent: { gap: spacing.md },
  dialogSettings: { overflow: "hidden" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.68 },
  loading: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    gap: spacing.xl,
    paddingHorizontal: layout.screenPadding,
  },
  loadingIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  loadingCopy: { flex: 1, gap: spacing.sm },
}));
