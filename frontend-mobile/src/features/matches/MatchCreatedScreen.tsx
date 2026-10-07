import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { matchesApi } from "../../api/endpoints/matches";
import { profilesApi } from "../../api/endpoints/profiles";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { PetalBackdrop } from "../../components/ui/PetalBackdrop";
import { Text } from "../../components/ui/Text";
import { shadows } from "../../theme/shadows";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import type { MatchDetailDto } from "../../types/match";

// The Yariva mark frames the portraits; shared petals decorate only the edges.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const petalArtwork = require("../../../assets/brand/petal-artwork.png");

export const MatchCreatedScreen: React.FC = () => {
  const { palette, resolved } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchDetailDto | null>(null);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (!params.matchId) return;
        setMatch(await matchesApi.get(params.matchId));
      } catch {
        // The celebration remains usable if the profile request is delayed.
      }
    })();
  }, [params.matchId]);

  useEffect(() => {
    void profilesApi
      .me()
      .then((profile) => {
        const photo =
          profile.photos.find((item) => item.isPrimary)?.url ?? profile.photos[0]?.url ?? null;
        setMyPhoto(photo);
      })
      .catch(() => undefined);
  }, []);

  const partnerPhoto =
    match?.otherUser.photos.find((photo) => photo.isPrimary)?.url ??
    match?.otherUser.photos[0]?.url;
  const partnerName = match?.otherUser.displayName ?? "your match";
  const heroSize = Math.min(width - spacing.xxl * 2, 320);
  const avatarSize = Math.min(108, Math.max(84, Math.round(heroSize * 0.32)));

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[palette.background, palette.surfaceTint, palette.background]}
        locations={[0, 0.54, 1]}
        style={StyleSheet.absoluteFill}
      />
      <PetalBackdrop variant="celebration" />
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.content}>
            <Text variant="display" color="textBrand" align="center">
              You matched.
            </Text>

            <View style={[styles.hero, { width: heroSize, height: heroSize }]}>
              <Image
                accessible={false}
                source={petalArtwork}
                resizeMode="contain"
                style={styles.petalArt}
              />
              <View
                style={[
                  styles.portraits,
                  { top: heroSize * 0.38, paddingHorizontal: heroSize * 0.055 },
                ]}
              >
                <View
                  accessible
                  accessibilityLabel="Your photo"
                  style={[
                    styles.portraitRing,
                    shadows.md,
                    { borderColor: palette.surface, borderRadius: avatarSize },
                  ]}
                >
                  <Avatar uri={myPhoto} initials="Me" size={avatarSize} />
                </View>
                <View
                  accessible
                  accessibilityLabel={`${partnerName}'s photo`}
                  style={[
                    styles.portraitRing,
                    shadows.md,
                    { borderColor: palette.surface, borderRadius: avatarSize },
                  ]}
                >
                  <Avatar uri={partnerPhoto} initials={partnerName} size={avatarSize} />
                </View>
              </View>
            </View>

            <View style={styles.copy}>
              <Text variant="title" align="center">
                You and {partnerName} both said yes.
              </Text>
              <Text variant="body" color="textSecondary" align="center">
                Start with something kind.
              </Text>
            </View>

            <View style={styles.actions}>
              <Button
                label="Say hello"
                fullWidth
                onPress={() => {
                  if (match?.conversationId) {
                    router.replace({
                      pathname: "/(app)/conversation/[conversationId]",
                      params: { conversationId: match.conversationId },
                    });
                  } else {
                    router.replace("/(app)/(tabs)/chats");
                  }
                }}
              />
              <Button
                label="Keep discovering"
                variant="ghost"
                fullWidth
                onPress={() => router.replace("/(app)/(tabs)/discover")}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: spacing.lg,
  },
  hero: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  petalArt: {
    width: "100%",
    height: "100%",
  },
  portraits: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  portraitRing: {
    borderWidth: 3,
    overflow: "hidden",
  },
  copy: {
    alignItems: "center",
    gap: spacing.xs,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
