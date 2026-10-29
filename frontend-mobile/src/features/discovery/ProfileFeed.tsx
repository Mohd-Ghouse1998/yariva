import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, View, type ViewToken } from "react-native";
import { ProfilePreviewCard } from "../../components/dating/ProfilePreviewCard";
import { layout, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import type { PublicProfileDto } from "../../types/profile";

/** The header scrolls with the feed; profiles snap to measured full-height pages. */
export const ProfileFeed: React.FC<{
  profiles: PublicProfileDto[];
  header: React.ReactElement;
  refreshing: boolean;
  selectedUserId?: string;
  onRefresh: () => void;
  onOpen: (profile: PublicProfileDto) => void;
  onInterested: (profile: PublicProfileDto) => void;
  onNotForMe: (profile: PublicProfileDto) => void;
  onViewed: (info: { viewableItems: Array<ViewToken<PublicProfileDto>> }) => void;
  empty: React.ReactElement;
}> = ({
  profiles,
  header,
  refreshing,
  selectedUserId,
  onRefresh,
  onOpen,
  onInterested,
  onNotForMe,
  onViewed,
  empty,
}) => {
  const { palette } = useTheme();
  const list = useRef<FlatList<PublicProfileDto>>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const active = useRef({ userId: profiles[0]?.userId, index: 0, headerVisible: true });
  const profileOffset = useCallback(
    (index: number) => headerHeight + index * pageHeight,
    [headerHeight, pageHeight],
  );

  // Preserve the person in view through refresh, Undo, removals and resizing.
  // If removed, show their successor (or the last remaining person).
  useLayoutEffect(() => {
    const found = profiles.findIndex((profile) => profile.userId === active.current.userId);
    const index =
      found >= 0 ? found : Math.min(active.current.index, Math.max(profiles.length - 1, 0));
    active.current = { ...active.current, userId: profiles[index]?.userId, index };
    if (pageHeight > 0)
      list.current?.scrollToOffset({
        offset: active.current.headerVisible ? 0 : profileOffset(index),
        animated: false,
      });
  }, [pageHeight, profileOffset, profiles]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 600,
  }).current;
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: pageHeight,
      offset: profileOffset(index),
      index,
    }),
    [pageHeight, profileOffset],
  );
  const snapOffsets =
    headerHeight > 0 && pageHeight > 0
      ? [0, ...profiles.map((_, index) => profileOffset(index))]
      : undefined;

  return (
    <FlatList
      ref={list}
      accessibilityLabel="Discover profiles"
      style={{ flex: 1 }}
      data={profiles}
      extraData={{ pageHeight, headerHeight, selectedUserId }}
      onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      ListHeaderComponent={
        <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>{header}</View>
      }
      keyExtractor={(profile) => profile.userId}
      getItemLayout={getItemLayout}
      snapToOffsets={snapOffsets}
      snapToAlignment="start"
      disableIntervalMomentum
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(event) => {
        if (pageHeight <= 0 || headerHeight <= 0 || profiles.length === 0) return;
        const offset = event.nativeEvent.contentOffset.y;
        const index = Math.max(
          0,
          Math.min(
            profiles.length - 1,
            Math.round((offset - headerHeight) / pageHeight),
          ),
        );
        active.current = {
          userId: profiles[index].userId,
          index,
          headerVisible: offset < headerHeight / 2,
        };
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.brandStrong}
          colors={[palette.brandStrong]}
          progressBackgroundColor={palette.surface}
        />
      }
      contentContainerStyle={profiles.length === 0 ? { flexGrow: 1 } : undefined}
      renderItem={({ item, index }) => (
        <View
          style={{
            height: pageHeight,
            width: "100%",
            maxWidth: layout.contentMaxWidth,
            alignSelf: "center",
            paddingBottom: spacing.xs,
          }}
        >
          {pageHeight > 0 ? (
            <ProfilePreviewCard
              profile={item}
              position={index + 1}
              total={profiles.length}
              availableHeight={Math.max(1, pageHeight - spacing.xs)}
              onOpen={onOpen}
              onInterested={onInterested}
              onNotForMe={onNotForMe}
              interestSelected={selectedUserId === item.userId}
            />
          ) : null}
        </View>
      )}
      initialNumToRender={2}
      windowSize={5}
      onViewableItemsChanged={onViewed}
      viewabilityConfig={viewabilityConfig}
      ListEmptyComponent={
        <View style={{ flexGrow: 1, justifyContent: "center" }}>{empty}</View>
      }
    />
  );
};
