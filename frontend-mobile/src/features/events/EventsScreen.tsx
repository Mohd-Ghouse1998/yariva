import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VenueArtwork } from "../../components/datePlans/VenueArtwork";
import { SegmentedControl } from "../../components/dating/SegmentedControl";
import { TabHeader } from "../../components/layout/TabHeader";
import { useBottomNavigationInset } from "../../components/navigation/bottomNavigation";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { useResponsiveLayout } from "../../theme/responsive";
import { controlSize, layout, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import {
  EVENT_CATEGORIES,
  type EventCategory,
  type EventListingDto,
  type EventQuery,
} from "../../types/events";
import { captureCurrentLocation } from "../../utils/location";
import { eventCategoryLabel, eventFailureCopy, eventLocale, eventPrice, eventSchedule } from "./eventPresentation";
import { useEventsFeed } from "./useEventsFeed";

export function EventsScreen() {
  const router = useRouter();
  const { t, language } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  const responsive = useResponsiveLayout();
  const bottomInset = useBottomNavigationInset();
  const [query, setQuery] = useState<EventQuery>({ city: "Hyderabad", limit: 20 });
  const { page, state, busy, error, refresh, more, retry } = useEventsFeed(query);
  const [city, setCity] = useState(query.city);
  const [area, setArea] = useState("");
  const [category, setCategory] = useState<EventCategory>();
  const [days, setDays] = useState<7 | 30>();
  const [price, setPrice] = useState<number>();
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number }>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const locationRequest = useRef(0);
  const saved = query.saved === "true";
  useFocusEffect(
    useCallback(
      () => () => {
        locationRequest.current += 1;
      },
      [],
    ),
  );

  function closeFilters() {
    locationRequest.current += 1;
    setLocationBusy(false);
    setFiltersOpen(false);
  }

  async function locate() {
    const request = ++locationRequest.current;
    setLocationBusy(true);
    setFilterError(null);
    try {
      const result = await captureCurrentLocation();
      if (request !== locationRequest.current) return;
      if (!result.ok || result.source === "preset") {
        setFilterError(t("events.location.denied"));
        return;
      }
      // Search-only, approximate coordinates; never update a public profile.
      setCoordinates({
        latitude: Number(result.latitude.toFixed(3)),
        longitude: Number(result.longitude.toFixed(3)),
      });
      if (result.city) setCity(result.city);
      setArea("");
    } catch {
      if (request === locationRequest.current) setFilterError(t("events.location.denied"));
    } finally {
      if (request === locationRequest.current) setLocationBusy(false);
    }
  }

  function apply() {
    if (!city.trim()) {
      setFilterError(t("events.city.required"));
      return;
    }
    setQuery({
      city: city.trim(),
      area: area.trim() || undefined,
      category,
      saved: query.saved,
      limit: 20,
      ...coordinates,
      from: days ? new Date().toISOString() : undefined,
      until: days ? new Date(Date.now() + days * 86400000).toISOString() : undefined,
      maxPricePaise: price,
    });
    closeFilters();
  }

  function openFilters() {
    setCity(query.city);
    setArea(query.area ?? "");
    setCategory(query.category);
    setPrice(query.maxPricePaise);
    const span =
      query.from && query.until
        ? Math.round((Date.parse(query.until) - Date.parse(query.from)) / 86400000)
        : undefined;
    setDays(span === 30 ? 30 : span === 7 ? 7 : undefined);
    setCoordinates(
      query.latitude === undefined
        ? undefined
        : { latitude: query.latitude, longitude: query.longitude! },
    );
    setFilterError(null);
    setFiltersOpen(true);
  }

  const header = (
    <View style={styles.section}>
      <SegmentedControl
        value={saved ? "saved" : "explore"}
        variant="underline"
        accessibilityLabel={t("events.sections")}
        options={[
          { value: "explore", label: t("events.explore") },
          { value: "saved", label: t("events.saved") },
        ]}
        onChange={(value) =>
          setQuery((previous) => ({ ...previous, saved: value === "saved" ? "true" : "false" }))
        }
      />
      <View style={styles.toolbar}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{query.area || query.city}</Text>
          <Text variant="caption" color="textSubdued">
            {saved
              ? t("events.private")
              : query.latitude === undefined
                ? t("events.city.results")
                : t("events.location.results")}
          </Text>
        </View>
        <Button label={t("events.filters")} variant="secondary" size="sm" onPress={openFilters} />
      </View>
      {query.category || query.from || query.maxPricePaise !== undefined ? (
        <View style={styles.wrap}>
          {query.category ? (
            <Text variant="caption" color="textSubdued">
              {eventCategoryLabel(query.category, t)}
            </Text>
          ) : null}
          {query.from ? (
            <Text variant="caption" color="textSubdued">
              {t("events.days", {
                days: Math.round((Date.parse(query.until!) - Date.parse(query.from)) / 86400000),
              })}
            </Text>
          ) : null}
          {query.maxPricePaise !== undefined ? (
            <Text variant="caption" color="textSubdued">
              {query.maxPricePaise === 0 ? t("events.free") : t("events.price.cap")}
            </Text>
          ) : null}
        </View>
      ) : null}
      {state === "error" ? (
        <View style={styles.section} accessibilityLiveRegion="polite">
          <Text variant="bodyStrong">{t("events.error.title")}</Text>
          <Text variant="body" color="textSubdued">
            {eventFailureCopy(error, t, "events.error.body")}
          </Text>
          <Button
            label={t("events.retry")}
            variant="secondary"
            disabled={busy}
            onPress={() => void retry()}
          />
        </View>
      ) : null}
    </View>
  );

  const empty =
    state === "loading" ? (
      <Text variant="body" color="textSubdued" accessibilityLiveRegion="polite">
        {t("events.loading")}
      </Text>
    ) : state === "disabled" ? (
      <EmptyState title={t("events.disabled.title")} body={t("events.disabled.body")} />
    ) : state !== "ready" ? null : saved ? (
      <EmptyState title={t("events.saved.empty")} body={t("events.saved.hint")} />
    ) : (
      <View style={styles.section}>
        <Text variant="bodyStrong">{t("events.empty")}</Text>
        {page.placesStatus ? (
          <>
            <Text variant="heading" accessibilityRole="header">
              {t("events.places")}
            </Text>
            <Text variant="caption" color="textSubdued">
              {page.placesStatus === "UNSUPPORTED_FILTERS"
                ? t("events.places.filters")
                : t("events.places.hint")}
            </Text>
            {page.places?.length ? (
              page.places.map((place) => (
                <View
                  key={place.id}
                  style={[styles.place, !place.photoUrl ? styles.placeWithoutPhoto : null]}
                >
                  <VenueArtwork
                    photoUrl={place.photoUrl}
                    category={place.category}
                    style={[styles.placeImage, !place.photoUrl ? styles.placeIcon : null]}
                  />
                  <View style={[styles.section, !place.photoUrl ? styles.flex : null]}>
                    <Text variant="heading">{place.name}</Text>
                    <Text variant="body" color="textSubdued">
                      {place.publicLocality}
                    </Text>
                    {place.distanceKm != null ? (
                      <Text variant="caption" color="textSubdued">
                        {t("events.distance", { distance: place.distanceKm })}
                      </Text>
                    ) : null}
                    <Text variant="caption" color="textSubdued">
                      {place.reviewSource} ·{" "}
                      {place.reviewedAt
                        ? t("events.reviewed", {
                            date: new Date(place.reviewedAt).toLocaleDateString(eventLocale(language)),
                          })
                        : t("events.details.unknown")}
                    </Text>
                    <Text variant="caption" color="textSubdued">
                      {place.priceMaxPerPerson == null
                        ? t("events.places.price.unknown")
                        : t("events.places.price", {
                            price: new Intl.NumberFormat(eventLocale(language), {
                              style: "currency",
                              currency: place.currency ?? "INR",
                            }).format(place.priceMaxPerPerson),
                          })}
                    </Text>
                    <Text variant="caption" color="textSubdued">
                      {t("events.places.unknown")}
                    </Text>
                    <Button
                      label={t("events.place.plan")}
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/date-plan",
                          params: { reviewedVenueId: place.id },
                        })
                      }
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text variant="body" color="textSubdued">
                {t("events.places.empty")}
              </Text>
            )}
          </>
        ) : null}
      </View>
    );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <TabHeader
        title={t("events.title")}
        right={
          <Button
            label={t("events.myPlans")}
            variant="ghost"
            size="sm"
            onPress={() => router.push("/(app)/date-plan")}
          />
        }
      />
      <FlatList<EventListingDto>
        data={state === "disabled" ? [] : page.items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: responsive.screenPadding, paddingBottom: bottomInset + spacing.xl },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={busy && page.items.length > 0}
            onRefresh={() => void refresh()}
            tintColor={palette.brandStrong}
          />
        }
        onEndReached={() => {
          if (state === "ready") void more();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          page.nextCursor && state !== "error" ? (
            <Button
              label={t("events.more")}
              variant="ghost"
              loading={busy}
              disabled={busy}
              onPress={() => void more()}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() =>
              router.push({ pathname: "/(app)/events/[eventId]", params: { eventId: item.id } })
            }
          />
        )}
      />
      <BottomSheet
        visible={filtersOpen}
        onClose={closeFilters}
        heightFraction={0.88}
        scrollable
        accessibilityLabel={t("events.filters")}
        contentContainerStyle={styles.filters}
      >
        <Text variant="heading">{t("events.filters")}</Text>
        <Text variant="caption" color="textSubdued">
          {t("events.location.consent")}
        </Text>
        <Button
          label={t("events.location.use")}
          variant="secondary"
          loading={locationBusy}
          disabled={locationBusy}
          onPress={() => void locate()}
        />
        {coordinates ? (
          <Button
            label={t("events.location.manual")}
            variant="ghost"
            onPress={() => {
              locationRequest.current += 1;
              setCoordinates(undefined);
              setLocationBusy(false);
            }}
          />
        ) : null}
        <Input
          label={t("events.city")}
          value={city}
          onChangeText={(value) => {
            locationRequest.current += 1;
            setLocationBusy(false);
            setCity(value);
            setCoordinates(undefined);
          }}
          maxLength={120}
        />
        <Input label={t("events.area")} value={area} onChangeText={setArea} maxLength={160} />
        <View style={styles.wrap}>
          <Chip
            label={t("events.category.all")}
            selected={!category}
            onPress={() => setCategory(undefined)}
          />
          {EVENT_CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={eventCategoryLabel(value, t)}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
        <View style={styles.wrap}>
          <Chip label={t("events.date.any")} selected={!days} onPress={() => setDays(undefined)} />
          {([7, 30] as const).map((value) => (
            <Chip
              key={value}
              label={t("events.days", { days: value })}
              selected={days === value}
              onPress={() => setDays(value)}
            />
          ))}
        </View>
        <View style={styles.wrap}>
          <Chip
            label={t("events.price.any")}
            selected={price === undefined}
            onPress={() => setPrice(undefined)}
          />
          <Chip label={t("events.free")} selected={price === 0} onPress={() => setPrice(0)} />
          <Chip
            label={t("events.price.cap")}
            selected={price === 50000}
            onPress={() => setPrice(50000)}
          />
        </View>
        {filterError ? (
          <Text variant="body" color="textBrand" accessibilityLiveRegion="polite">
            {filterError}
          </Text>
        ) : null}
        <Button label={t("events.apply")} disabled={locationBusy} onPress={apply} />
      </BottomSheet>
    </SafeAreaView>
  );
}

function EventCard({ event, onPress }: { event: EventListingDto; onPress: () => void }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const { t, language } = useLocalization();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("events.view", { title: event.title })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.photo}>
        {event.imageUrl && event.imageUrl !== failedImage ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.image}
            contentFit="cover"
            recyclingKey={event.id}
            onError={() => setFailedImage(event.imageUrl)}
          />
        ) : (
          <Icon name="calendar" size={32} color={palette.textSubdued} />
        )}
      </View>
      <View style={styles.eventCopy}>
        <Text variant="captionStrong" color="textBrand">
          {eventSchedule(event, language)}
        </Text>
        <View style={styles.toolbar}>
          <Text variant="heading" style={styles.flex}>
            {event.title}
          </Text>
          {event.saved ? <Icon name="bookmark" size={18} color={palette.textSubdued} /> : null}
        </View>
        <Text variant="body" color="textSubdued">
          {event.venueName} · {event.locality}
        </Text>
        <Text variant="caption" color="textSubdued">
          {eventPrice(event, language, t)}
          {event.distanceKm == null
            ? ""
            : ` · ${t("events.distance", { distance: event.distanceKm })}`}
        </Text>
        {event.unavailable ? (
          <Text variant="captionStrong" color="textBrand">
            {event.status === "CANCELLED" ? t("events.cancelled") : t("events.unavailable")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = createThemeStyleHook((p) => ({
  screen: { flex: 1, backgroundColor: p.background },
  content: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    gap: spacing.md,
  },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  section: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 100 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filters: { padding: spacing.lg, gap: spacing.md },
  card: { minHeight: controlSize.minimumTouchTarget, gap: spacing.md },
  photo: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: p.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  eventCopy: { gap: spacing.xs },
  separator: { height: spacing.lg },
  place: { gap: spacing.md, paddingVertical: spacing.md },
  placeWithoutPhoto: { flexDirection: "row", alignItems: "flex-start" },
  placeIcon: { width: 56, height: 64, aspectRatio: undefined },
  placeImage: { width: "100%", aspectRatio: 1.8 },
  pressed: { opacity: 0.72 },
}));
