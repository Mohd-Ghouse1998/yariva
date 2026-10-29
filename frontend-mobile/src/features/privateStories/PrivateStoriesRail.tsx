import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import React, { Fragment, useCallback, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { privateStoriesApi, type Story } from "../../api/endpoints/privateStories";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";

// Keep private Story data independent from Scene discovery while sharing its rail.
export const usePrivateStoryRail = (enabled: boolean) => {
  const [items, setItems] = useState<Story[]>([]);
  const [mine, setMine] = useState<Story[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // Changing retry re-runs this focus loader after the retry tile is pressed.
      void retry;
      if (!enabled) {
        setItems([]);
        setMine([]);
        setLoadError(false);
        setLoading(false);
        return;
      }
      let active = true;
      let version = 0;
      const clear = () => {
        version++;
        setItems([]);
        setMine([]);
        setLoading(false);
      };
      const load = () => {
        clear();
        if (AppState.currentState !== "active") return;
        const request = version;
        setLoadError(false);
        setLoading(true);
        void Promise.allSettled([privateStoriesApi.feed(), privateStoriesApi.mine()]).then(
        ([feed, own]) => {
          if (!active || request !== version) return;
          if (feed.status === "fulfilled") setItems(feed.value.items);
          if (own.status === "fulfilled") setMine(own.value.items);
          setLoadError(feed.status === "rejected" || own.status === "rejected");
          setLoading(false);
        },
        );
      };
      load();
      const listener = AppState.addEventListener("change", state => {
        if (state === "active") load();
        else clear();
      });
      return () => {
        active = false;
        listener.remove();
        clear();
      };
    }, [enabled, retry]),
  );

  return { items, mine, loadError, loading, retry: () => setRetry((value) => value + 1) };
};

export const PrivateStoryTiles: React.FC<{
  items: Story[];
  loadError: boolean;
  onOpen: (story: Story) => void;
  onRetry: () => void;
}> = ({ items, loadError, onOpen, onRetry }) => {
  const { palette } = useTheme();
  return (
    <Fragment>
      {loadError ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Private Stories unavailable. Retry loading"
          style={styles.tile}
        >
          <View style={[styles.ring, { borderColor: palette.borderSubdued }]}>
            <View style={[styles.core, { backgroundColor: palette.brandSubdued }]}>
              <Icon name="lock" size={25} color={palette.brand} />
            </View>
          </View>
          <Text variant="captionStrong" numberOfLines={1} align="center">
            Retry Stories
          </Text>
        </Pressable>
      ) : null}
      {items.map((story) => (
        <Pressable
          key={story.id}
          onPress={() => onOpen(story)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${story.ownerName ?? "a connection"}'s private Story`}
          style={styles.tile}
        >
          <View style={[styles.ring, { borderColor: palette.brandSecondary }]}>
            <View style={[styles.core, { backgroundColor: palette.premiumSubdued }]}>
              {story.previewUrl && story.mediaMimeType?.startsWith("image/") ? (
                <Image
                  source={{ uri: story.previewUrl }}
                  cachePolicy="none"
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <Text variant="bodyStrong" color="premium">
                  {(story.ownerName ?? "C").slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.privacyBadge,
                { backgroundColor: palette.brand, borderColor: palette.background },
              ]}
            >
              <Icon name="lock" size={10} color={palette.alwaysWhite} />
            </View>
          </View>
          <Text variant="captionStrong" numberOfLines={1} align="center">
            {story.ownerName ?? "Connection"}
          </Text>
        </Pressable>
      ))}
    </Fragment>
  );
};

const styles = StyleSheet.create({
  tile: { width: 76, minHeight: 88, alignItems: "center", gap: 4 },
  ring: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, padding: 3 },
  core: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyBadge: {
    position: "absolute",
    right: -2,
    bottom: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
