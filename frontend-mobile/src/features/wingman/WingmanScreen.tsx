import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Share, View } from "react-native";
import { wingmanApi } from "../../api/endpoints/wingman";
import { scenesApi } from "../../api/endpoints/scenes";
import { ApiError } from "../../api/errors";
import { Header } from "../../components/layout/Header";
import { Screen } from "../../components/layout/Screen";
import { Avatar } from "../../components/ui/Avatar";
import { Button, ButtonRow } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import type { SceneDto } from "../../types/scenes";
import type { WingmanStateDto } from "../../types/wingman";
import { DuoDiscoveryPanel } from "./DuoDiscoveryPanel";

export const WingmanScreen: React.FC<{ inviteToken?: string }> = ({ inviteToken }) => {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = inviteToken ?? (typeof params.token === "string" ? params.token : undefined);
  const { palette } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [state, setState] = useState<WingmanStateDto | null>(null);
  const [scene, setScene] = useState<SceneDto | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, mine] = await Promise.all([
        wingmanApi.mine(),
        scenesApi.mine().catch(() => ({ scene: null })),
      ]);
      setState(next);
      setScene(mine.scene);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError && loadError.code === "WINGMAN_NOT_AVAILABLE"
          ? "Duo is not available for this account yet."
          : "Duo could not load. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = useCallback(
    async (request: () => Promise<WingmanStateDto>, success: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const next = await request();
        setState(next);
        setDeepLink(null);
        toast.show(success, "success");
      } catch (actionError) {
        const message =
          actionError instanceof ApiError
            ? actionError.message
            : "That action could not be completed.";
        toast.show(message, "error");
      } finally {
        setBusy(false);
      }
    },
    [busy, toast],
  );

  const sendInvite = async () => {
    const value = identifier.trim();
    if (!value) {
      toast.show("Enter your friend’s Yariva email or phone.", "error");
      return;
    }
    setBusy(true);
    try {
      const next = await wingmanApi.invite(value);
      setState(next);
      setDeepLink(next.deepLink);
      setIdentifier("");
      toast.show("Private Duo invite sent.", "success");
    } catch (actionError) {
      toast.show(
        actionError instanceof ApiError ? actionError.message : "Couldn’t send that invite.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const title = state?.state === "ACTIVE" ? "Your Duo" : "Duo";
  const pending = state?.state === "PENDING" ? state.party?.invitation : null;
  const active = state?.state === "ACTIVE" ? state.party : null;

  return (
    <Screen scroll keyboardAvoiding padded={false} contentStyle={styles.screenContent}>
      <Header title={title} showBack onLeftPress={() => router.back()} />
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loading} accessibilityLabel="Loading Duo">
            <ActivityIndicator color={palette.brand} />
          </View>
        ) : error ? (
          <StatusBlock icon="wifi" title="Couldn’t load Duo" body={error} />
        ) : pending?.direction === "RECEIVED" ? (
          <>
            <HeroPair name={pending.inviter?.displayName ?? "A Yariva friend"} />
            <View style={styles.centerCopy}>
              <Text variant="heading" align="center">
                Join their Duo?
              </Text>
              <Text variant="body" color="textSubdued" align="center">
                Pair privately and choose the Scenes you want to discover with.
              </Text>
            </View>
            <ButtonRow>
              <Button
                label="Decline"
                variant="secondary"
                disabled={busy}
                onPress={() => void act(() => wingmanApi.decline(token), "Invite declined.")}
              />
              <Button
                label="Accept invite"
                loading={busy}
                onPress={() => void act(() => wingmanApi.accept(token), "Duo connected.")}
              />
            </ButtonRow>
            <ExpiryLine value={pending.expiresAt} />
          </>
        ) : pending?.direction === "SENT" ? (
          <>
            <StatusBlock
              icon="send"
              title="Invite sent"
              body="Your place is reserved until your friend responds."
            />
            <ExpiryLine value={pending.expiresAt} />
            {deepLink ? (
              <Button
                label="Share private link"
                variant="secondary"
                leftIcon={<Icon name="send" size={17} color={palette.textPrimary} />}
                onPress={() =>
                  void Share.share({ message: `Join my Duo on Yariva: ${deepLink}` })
                }
              />
            ) : null}
            <Button
              label="Cancel invite"
              variant="ghost"
              loading={busy}
              onPress={() =>
                void act(() => wingmanApi.cancel(pending.id), "Duo invite cancelled.")
              }
            />
          </>
        ) : active ? (
          <>
            <HeroPair name={active.buddy?.displayName ?? "Your friend"} connected />
            <Card style={styles.consentCard}>
              <View style={styles.consentHeader}>
                <View style={styles.consentIcon}>
                  <Icon name="sparkle" filled size={18} color={palette.premium} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">
                    {active.bothSceneConsented
                      ? "Your duo is ready"
                      : active.sceneConsent.current
                        ? "Waiting for your friend"
                        : "Approve your current Scene"}
                  </Text>
                  <Text variant="caption" color="textSubdued">
                    {active.bothSceneConsented
                      ? "Both current Scenes are approved for paired discovery."
                      : active.sceneConsent.current
                        ? "Your approval is saved. They still need to approve theirs."
                        : scene
                          ? scene.activity
                          : "Post a Scene first, then return here."}
                  </Text>
                </View>
                <Icon
                  name={active.sceneConsent.current ? "check" : "clock"}
                  size={19}
                  color={active.sceneConsent.current ? palette.success : palette.textMuted}
                />
              </View>
              {!scene ? (
                <Button
                  label="Open Discover"
                  variant="secondary"
                  onPress={() => router.replace("/(app)/(tabs)/discover")}
                />
              ) : !active.sceneConsent.current ? (
                <Button
                  label="Approve this Scene"
                  loading={busy}
                  onPress={() =>
                    void act(
                      () => wingmanApi.consentScene(active.id, scene.id, scene.version),
                      "Scene approved for your duo.",
                    )
                  }
                />
              ) : null}
            </Card>
            {active.bothSceneConsented ? <DuoDiscoveryPanel /> : null}
            <Button
              label="Leave Duo"
              variant="danger"
              loading={busy}
              onPress={() => void act(() => wingmanApi.leave(active.id), "Duo ended.")}
            />
          </>
        ) : (
          <>
            <StatusBlock
              icon="user"
              title={
                state?.state === "DISCONNECTED" ? "Start a new duo" : "Bring one trusted friend"
              }
              body="Invite an existing Yariva account. Only that friend can accept."
            />
            <Input
              label="Friend’s Yariva account"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Email or phone"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={() => void sendInvite()}
              leftIcon={<Icon name="user" size={18} color={palette.textMuted} />}
            />
            <Button label="Send private invite" loading={busy} onPress={() => void sendInvite()} />
          </>
        )}
        {error ? (
          <Button label="Try again" variant="secondary" onPress={() => void load()} />
        ) : null}
      </View>
    </Screen>
  );
};

const HeroPair: React.FC<{ name: string; connected?: boolean }> = ({ name, connected }) => {
  const styles = useStyles();
  const { palette } = useTheme();
  return (
    <View style={styles.hero}>
      <View style={styles.avatarPair}>
        <Avatar initials="ME" size={58} ring />
        <View style={styles.secondAvatar}>
          <Avatar initials={initials(name)} size={58} ring />
        </View>
        <View style={styles.pairBadge}>
          <Icon
            name={connected ? "check" : "sparkle"}
            filled
            size={13}
            color={palette.textOnBrand}
          />
        </View>
      </View>
      <Text variant="titleSm" align="center">
        {name}
      </Text>
      {connected ? (
        <Text variant="caption" color="success" align="center">
          Connected privately
        </Text>
      ) : null}
    </View>
  );
};

const StatusBlock: React.FC<{
  icon: "user" | "send" | "wifi";
  title: string;
  body: string;
}> = ({ icon, title, body }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.statusBlock}>
      <View style={styles.statusIcon}>
        <Icon name={icon} filled size={23} color={palette.premium} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" color="textSubdued" align="center">
        {body}
      </Text>
    </View>
  );
};

const ExpiryLine: React.FC<{ value: string }> = ({ value }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.expiry}>
      <Icon name="clock" size={15} color={palette.textMuted} />
      <Text variant="caption" color="textSubdued">
        Expires{" "}
        {new Date(value).toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "Y";

const useStyles = createThemeStyleHook((palette) => ({
  screenContent: { gap: 0 },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  loading: { minHeight: 260, alignItems: "center", justifyContent: "center" },
  statusBlock: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.premiumSubdued,
    marginBottom: spacing.xs,
  },
  centerCopy: { alignItems: "center", gap: spacing.sm },
  hero: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md },
  avatarPair: { width: 104, height: 66, marginBottom: spacing.sm },
  secondAvatar: { position: "absolute", right: 0, top: 0 },
  pairBadge: {
    position: "absolute",
    left: 43,
    top: 21,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.duoAccent,
    borderWidth: 2,
    borderColor: palette.background,
  },
  consentCard: { gap: spacing.md },
  consentHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  consentIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.premiumSubdued,
  },
  flex: { flex: 1, gap: spacing.xxs },
  expiry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
}));
