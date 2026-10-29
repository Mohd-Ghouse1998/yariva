import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { eventsApi } from "../../api/endpoints/events";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useSafeBack } from "../../navigation/useSafeBack";
import { layout, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { EVENT_CATEGORIES, type EventCategory, type EventListingDto, type EventQuery } from "../../types/events";
import { eventCategoryLabels, eventPrice, eventSchedule } from "./eventPresentation";

export function EventsScreen() {
  const router = useRouter();
  const back = useSafeBack("/(app)/(tabs)/date-plans");
  const { palette } = useTheme();
  const styles = useStyles();
  // Manual city/area entry never asks for or exposes a user's live location.
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState<EventCategory>();
  const [days, setDays] = useState<7 | 30>();
  const [price, setPrice] = useState<number>();
  const [saved, setSaved] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState<EventQuery>({ city: "Hyderabad", limit: 20 });
  const [items, setItems] = useState<EventListingDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const load = useCallback(async (active: EventQuery, next?: string) => {
    const request = ++sequence.current;
    setBusy(true);
    setError(null);
    try {
      const page = await eventsApi.list({ ...active, cursor: next });
      if (sequence.current !== request) return;
      setItems((previous) => next ? [...previous, ...page.items.filter((item) => !previous.some((old) => old.id === item.id))] : page.items);
      setCursor(page.nextCursor);
    } catch (e) {
      if (sequence.current === request) setError(e instanceof Error ? e.message : "Events couldn’t load. Try again.");
    } finally {
      if (sequence.current === request) setBusy(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(query);
    return () => { sequence.current += 1; };
  }, [load, query]));

  function apply() {
    if (!city.trim()) { setError("Enter a city to explore events."); return; }
    setItems([]);
    setCursor(null);
    setQuery({ city: city.trim(), area: area.trim() || undefined, category, saved: saved ? "true" : "false", limit: 20,
      from: days ? new Date().toISOString() : undefined,
      until: days ? new Date(Date.now() + days * 86400000).toISOString() : undefined, maxPricePaise: price });
    setFiltersOpen(false);
  }

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <Header title="Events" showBack onLeftPress={back} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={busy && items.length > 0} onRefresh={() => void load(query)} tintColor={palette.brandStrong} />}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="heading">Around {query.city}</Text>
            <Text variant="caption" color="textSubdued">{query.saved === "true" ? "Your private saved list" : "Public events to enjoy together"}</Text>
          </View>
          <Button label="Filters" variant="secondary" size="sm" onPress={() => setFiltersOpen((v) => !v)} />
        </View>
        {filtersOpen ? <Card style={styles.filterCard}>
          <Input label="City" value={city} onChangeText={setCity} maxLength={120} />
          <Input label="Area (optional)" value={area} onChangeText={setArea} maxLength={160} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Chip label="All categories" selected={!category} onPress={() => setCategory(undefined)} />
            {EVENT_CATEGORIES.map((value) => <Chip key={value} label={eventCategoryLabels[value]} selected={category === value} onPress={() => setCategory(value)} />)}
          </ScrollView>
          <View style={styles.wrap}>
            <Chip label="Any date" selected={!days} onPress={() => setDays(undefined)} />
            <Chip label="Next 7 days" selected={days === 7} onPress={() => setDays(7)} />
            <Chip label="Next 30 days" selected={days === 30} onPress={() => setDays(30)} />
          </View>
          <View style={styles.wrap}>
            <Chip label="Any price" selected={price === undefined} onPress={() => setPrice(undefined)} />
            <Chip label="Free" selected={price === 0} onPress={() => setPrice(0)} />
            <Chip label="Up to ₹500" selected={price === 50000} onPress={() => setPrice(50000)} />
            <Chip label="Saved only" selected={saved} onPress={() => setSaved((v) => !v)} />
          </View>
          <Button label="Apply filters" onPress={apply} />
        </Card> : null}
        {error ? <View accessibilityLiveRegion="polite" style={styles.filterCard}>
          <Text variant="body" color="textSubdued">{error}</Text>
          <Button label="Retry" variant="secondary" onPress={() => void load(query)} />
        </View> : null}
        {busy && items.length === 0 ? <Text variant="body" color="textSubdued">Loading events…</Text> : null}
        {!busy && !error && items.length === 0 ? <EmptyState title={query.saved === "true" ? "No saved events here" : "No events here yet"}
          body="Try a different area or date range. New listings appear after their details are reviewed." /> : null}
        {items.map((event) => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`View ${event.title}`}
          onPress={() => router.push({ pathname: "/(app)/events/[eventId]", params: { eventId: event.id } })}>
          <Card style={styles.row}>
            {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.thumbnail} contentFit="cover" /> :
              <View style={styles.fallback}><Icon name="calendar" size={24} color={palette.brandStrong} /></View>}
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={2}>{event.title}</Text>
              <Text variant="caption" color="textSubdued">{eventSchedule(event)}</Text>
              <Text variant="caption" color="textSubdued" numberOfLines={1}>{event.locality} · {eventPrice(event)}</Text>
              {event.unavailable ? <Text variant="captionStrong" color="textBrand">{event.status === "CANCELLED" ? "Cancelled" : "Unavailable · check source"}</Text> : null}
            </View>
            <Icon name={event.saved ? "bookmark" : "chevronRight"} size={18} color={palette.textSubdued} />
          </Card>
        </Pressable>)}
        {cursor ? <Button label="Load more" variant="secondary" disabled={busy} loading={busy} onPress={() => void load(query, cursor)} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemeStyleHook((p) => ({
  screen: { flex: 1, backgroundColor: p.background },
  content: { width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center", padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  filterCard: { gap: spacing.sm },
  thumbnail: { width: 72, height: 88, borderRadius: radius.control },
  fallback: { width: 72, height: 88, borderRadius: radius.control, backgroundColor: p.surfaceMuted, alignItems: "center", justifyContent: "center" },
}));
