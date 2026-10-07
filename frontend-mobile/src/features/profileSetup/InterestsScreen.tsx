import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { interestsApi } from "../../api/endpoints/interests";
import { usersApi } from "../../api/endpoints/users";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { InterestTagDto } from "../../types/profile";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenInterests.
// Groups by category, search bar at top, sticky bottom CTA showing count.
export const InterestsScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/lifestyle");
  const hydration = useProfileHydration();
  const catalogRequest = useRef(0);
  const [items, setItems] = useState<InterestTagDto[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async (query: string) => {
    const request = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const page = await interestsApi.catalog({ search: query || undefined, limit: 100 });
      if (catalogRequest.current === request) setItems(page.items);
    } catch (cause) {
      if (catalogRequest.current === request) {
        setCatalogError(cause instanceof Error ? cause.message : "Couldn’t load interests.");
      }
    } finally {
      if (catalogRequest.current === request) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydration.profile) {
      setSelected(new Set(hydration.profile.interests.map((interest) => interest.id)));
    }
  }, [hydration.profile]);

  useEffect(() => {
    const t = setTimeout(() => void fetchItems(search), 250);
    return () => clearTimeout(t);
  }, [search, fetchItems]);

  const grouped = useMemo(() => {
    const buckets: Record<string, InterestTagDto[]> = {};
    items.forEach((it) => {
      const cat = it.category ?? "Other";
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(it);
    });
    return buckets;
  }, [items]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onContinue = async () => {
    if (selected.size < 5) {
      toast.show("Pick at least 5 interests.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.setInterests(Array.from(selected));
      flow.complete();
    } catch {
      toast.show("Couldn’t save. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (hydration.loading || hydration.error || !hydration.profile) {
    return (
      <ProfileSectionLoadState
        title={flow.editMode ? "Interests" : "What lights you up?"}
        subtitle={flow.editMode ? "Interests" : "Pick at least 5 — they help us find your people."}
        step={flow.editMode ? undefined : 4}
        total={flow.editMode ? undefined : 9}
        contextLabel={flow.stepLabel}
        loading={hydration.loading}
        error={hydration.error}
        onBack={flow.goBack}
        onRetry={() => void hydration.reload()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <StepHeader
          step={flow.editMode ? undefined : 4}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Interests" : "What lights you up?"}
          subtitle={
            flow.editMode ? "Interests" : "Pick at least 5 — they help us find your people."
          }
          onBack={flow.goBack}
        />
        <View style={[formLayout.content, { paddingBottom: 8 }]}>
          <Input
            placeholder="Search interests…"
            value={search}
            onChangeText={setSearch}
            maxLength={80}
            autoCapitalize="none"
            leftIcon={<Icon name="search" size={18} color={palette.textSubdued} />}
          />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={formLayout.content}>
          {catalogLoading ? (
            <Text variant="body" color="textSubdued">
              Loading…
            </Text>
          ) : catalogError ? (
            <View style={{ gap: 10, alignItems: "flex-start" }}>
              <Text variant="body" color="error">
                We couldn’t load interests.
              </Text>
              <Button
                label="Try again"
                variant="secondary"
                onPress={() => void fetchItems(search)}
              />
            </View>
          ) : Object.keys(grouped).length === 0 ? (
            <Text variant="body" color="textSubdued">
              No interests match your search.
            </Text>
          ) : (
            Object.entries(grouped).map(([cat, list]) => (
              <View key={cat}>
                <Text variant="captionStrong" color="textSubdued" style={styles.groupLabel}>
                  {cat.toUpperCase()}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {list.map((tag) => (
                    <Chip
                      key={tag.id}
                      label={tag.displayName}
                      selected={selected.has(tag.id)}
                      onPress={() => toggle(tag.id)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <ScreenFooter safeAreaHandled>
          <Text variant="caption" color="textSubdued" align="center" style={{ marginBottom: 10 }}>
            {selected.size} selected
          </Text>
          <Button
            label={flow.primaryLabel}
            variant="primary"
            fullWidth
            loading={submitting}
            onPress={onContinue}
            disabled={selected.size < 5 || catalogLoading || Boolean(catalogError)}
          />
        </ScreenFooter>
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((_palette) => ({
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
}));
