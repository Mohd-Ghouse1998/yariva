import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { profilesApi } from "../../api/endpoints/profiles";
import { Header } from "../../components/layout/Header";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import type { MyProfileDto } from "../../types/profile";
import {
  createProfileSectionEditHref,
  PROFILE_EDITOR_ROUTE,
} from "../profileSetup/profileSectionRouting";

/** One entry per editor; photos, bio and intent have a single shared owner. */
export const EditProfileScreen = () => {
  const router = useRouter(),
    back = useSafeBack("/(app)/(tabs)/profile");
  const responsive = useResponsiveLayout(),
    { palette } = useTheme();
  const [profile, setProfile] = useState<MyProfileDto | null>(null),
    [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      setProfile(await profilesApi.me());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const edit = (section: string) =>
    router.push(createProfileSectionEditHref(`/(onboarding)/${section}`, PROFILE_EDITOR_ROUTE));
  return (
    <Screen scroll contentStyle={{ gap: spacing.lg }}>
      <View style={{ marginHorizontal: -responsive.screenPadding }}>
        <Header title="Edit profile" showBack onLeftPress={back} />
      </View>
      {!profile && !error ? <ActivityIndicator color={palette.brand} /> : null}
      {error ? (
        <View style={{ gap: spacing.sm }}>
          <Text color="error">Couldn’t load your profile.</Text>
          <Button label="Retry" variant="secondary" onPress={() => void load()} />
        </View>
      ) : null}
      {profile ? (
        <>
          <NavigationListSection label="ABOUT YOU">
            <NavigationListRow
              first
              icon="user"
              label="Basic details"
              meta={[profile.displayName, profile.city].filter(Boolean).join(" · ")}
              onPress={() => edit("basic-info")}
            />
            <NavigationListRow
              icon="edit"
              label="Bio & headline"
              meta={profile.headline ?? "A few words about you"}
              onPress={() => edit("bio")}
            />
            <NavigationListRow
              icon="image"
              label="Photos"
              meta={`${profile.photos.length} photos`}
              onPress={() => edit("photos")}
            />
            <NavigationListRow
              icon="spark"
              label="Interests"
              meta={`${profile.interests.length} selected`}
              onPress={() => edit("interests")}
            />
            <NavigationListRow icon="leaf" label="Lifestyle" onPress={() => edit("lifestyle")} />
          </NavigationListSection>
          <NavigationListSection label="PREFERENCES">
            <NavigationListRow
              first
              icon="heart"
              label="Looking for"
              onPress={() => edit("intent")}
            />
            <NavigationListRow
              icon="compass"
              label="Discovery preferences"
              onPress={() => edit("discovery-preferences")}
            />
            <NavigationListRow
              icon="calendar"
              label="Usually free"
              onPress={() => edit("schedule")}
            />
          </NavigationListSection>
          <NavigationListSection label="OPTIONAL DETAILS">
            <NavigationListRow
              first
              icon="globe"
              label="Languages & values"
              meta="Add what matters to you"
              onPress={() => router.push("/(app)/settings/profile/details")}
            />
            <NavigationListRow
              icon="chat"
              label="Conversation starters"
              meta={`${profile.promptResponses.length} answers`}
              onPress={() => router.push("/(app)/settings/profile/prompts")}
            />
          </NavigationListSection>
        </>
      ) : null}
    </Screen>
  );
};
