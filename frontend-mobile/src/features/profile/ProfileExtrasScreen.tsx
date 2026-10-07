import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { profilesApi } from "../../api/endpoints/profiles";
import { Header } from "../../components/layout/Header";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Chip } from "../../components/ui/Chip";
import { Input } from "../../components/ui/Input";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
import { useProfileHydration } from "../profileSetup/useProfileHydration";
import { PROFILE_PROMPTS } from "./profilePrompts";
import { RELATIONSHIP_PACE } from "../../types/enums";
import {
  profileExtrasUpdate,
  profileToEditForm,
  validateProfileEditForm,
  type ProfileEditFormValue,
} from "./profileEditForm";

const OPTIONAL_FIELDS = [
  ["relocationOpenness", "Relocation", 80],
  ["careerPriority", "Career", 80],
  ["familyComfort", "Family involvement", 120],
  ["marriageTimeline", "Marriage timeline", 80],
  ["childrenPreference", "Children", 80],
  ["religionSpirituality", "Religion & spirituality", 120],
] as const;
export function ProfileExtrasScreen({ prompts = false }: { prompts?: boolean }) {
  const hydration = useProfileHydration(),
    back = useSafeBack("/(app)/settings/edit-profile"),
    toast = useToast(),
    layout = useResponsiveLayout();
  const [form, setForm] = useState<ProfileEditFormValue | null>(null),
    [saving, setSaving] = useState(false),
    [more, setMore] = useState(false),
    [choice, setChoice] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const dirty = Boolean(
    form &&
    hydration.profile &&
    JSON.stringify(profileExtrasUpdate(form, prompts)) !==
      JSON.stringify(profileExtrasUpdate(profileToEditForm(hydration.profile), prompts)),
  );
  const requestBack = useCallback(() => {
    if (saving) return;
    if (dirty) setDiscard(true);
    else back();
  }, [saving, dirty, back]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        requestBack();
        return true;
      });
      return () => subscription.remove();
    }, [requestBack]),
  );
  useEffect(() => {
    if (hydration.profile) setForm(profileToEditForm(hydration.profile));
  }, [hydration.profile]);
  const update = <K extends keyof ProfileEditFormValue>(key: K, value: ProfileEditFormValue[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  const save = async () => {
    if (!form) return;
    const valid = validateProfileEditForm({
      ...form,
      headline: "",
      bio: "Additional profile details",
    });
    if (!valid.valid) {
      toast.show(valid.message, "warning");
      return;
    }
    setSaving(true);
    try {
      await profilesApi.updateMe(profileExtrasUpdate(form, prompts));
      back();
    } catch {
      toast.show("Couldn’t save your changes.", "error");
    } finally {
      setSaving(false);
    }
  };
  const selected = form ? PROFILE_PROMPTS.filter((p) => p.id in form.promptResponses) : [];
  return (
    <Screen
      scroll
      keyboardAvoiding
      contentStyle={{ gap: spacing.lg }}
      bottomBar={
        form ? (
          <Button label="Save changes" fullWidth loading={saving} onPress={() => void save()} />
        ) : undefined
      }
    >
      <View style={{ marginHorizontal: -layout.screenPadding }}>
        <Header
          title={prompts ? "Conversation starters" : "Languages & values"}
          showBack
          onLeftPress={requestBack}
        />
      </View>
      <CenterDialog
        visible={discard}
        onClose={() => setDiscard(false)}
        accessibilityLabel="Discard changes"
        style={{ gap: spacing.md }}
      >
        <Text variant="subheading">Discard changes?</Text>
        <Button label="Keep editing" onPress={() => setDiscard(false)} />
        <Button
          label="Discard"
          variant="ghost"
          onPress={() => {
            setDiscard(false);
            back();
          }}
        />
      </CenterDialog>
      {hydration.error ? (
        <>
          <Text color="error">Couldn’t load your details.</Text>
          <Button label="Retry" onPress={() => void hydration.reload()} />
        </>
      ) : !form ? (
        <Text color="textSubdued">Loading…</Text>
      ) : prompts ? (
        <>
          {selected.length > 0 ? (
            <NavigationListSection>
              {selected.map((prompt, index) => (
                <NavigationListRow
                  key={prompt.id}
                  first={index === 0}
                  icon="chat"
                  label={prompt.label}
                  labelLines={2}
                  meta={form.promptResponses[prompt.id] || "Add your answer"}
                  onPress={() => setEditingPrompt(prompt.id)}
                />
              ))}
            </NavigationListSection>
          ) : null}
          <CenterDialog
            visible={editingPrompt !== null}
            onClose={() => setEditingPrompt(null)}
            accessibilityLabel="Edit conversation starter"
            style={{ gap: spacing.md }}
          >
            <Text variant="subheading">
              {PROFILE_PROMPTS.find((p) => p.id === editingPrompt)?.label}
            </Text>
            <Input
              accessibilityLabel="Your answer"
              multiline
              maxLength={500}
              value={editingPrompt ? (form.promptResponses[editingPrompt] ?? "") : ""}
              onChangeText={(answer) => {
                if (editingPrompt)
                  update("promptResponses", { ...form.promptResponses, [editingPrompt]: answer });
              }}
            />
            <Button label="Done" onPress={() => setEditingPrompt(null)} />
            <Button
              label="Remove answer"
              variant="ghost"
              onPress={() => {
                if (editingPrompt) {
                  const values = { ...form.promptResponses };
                  delete values[editingPrompt];
                  update("promptResponses", values);
                }
                setEditingPrompt(null);
              }}
            />
          </CenterDialog>
          {selected.length < 3 ? (
            <Button
              label="Add a conversation starter"
              variant="secondary"
              onPress={() => setChoice(true)}
            />
          ) : null}
          <CenterDialog
            visible={choice}
            onClose={() => setChoice(false)}
            accessibilityLabel="Choose a conversation starter"
            style={{ gap: spacing.md }}
          >
            <Text variant="heading">Choose a starter</Text>
            {PROFILE_PROMPTS.filter((p) => !(p.id in form.promptResponses)).map((p) => (
              <Button
                key={p.id}
                label={p.label}
                variant="ghost"
                onPress={() => {
                  update("promptResponses", { ...form.promptResponses, [p.id]: "" });
                  setChoice(false);
                  setEditingPrompt(p.id);
                }}
              />
            ))}
          </CenterDialog>
        </>
      ) : (
        <>
          <Input
            label="Languages"
            value={form.languages}
            onChangeText={(v) => update("languages", v)}
            placeholder="English, Hindi, Telugu"
          />
          <Input
            label="Food preferences"
            value={form.foodPreferences}
            onChangeText={(v) => update("foodPreferences", v)}
            placeholder="Vegetarian, café food"
          />
          <Text variant="captionStrong" color="textSubdued">
            Relationship pace
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {([null, ...RELATIONSHIP_PACE] as const).map((pace, i) => (
              <Chip
                key={pace ?? "unset"}
                label={
                  [
                    "Not set",
                    "Slow & steady",
                    "Open to exploring",
                    "Intentional",
                    "Ready to commit",
                  ][i]
                }
                selected={form.relationshipPace === pace}
                onPress={() => update("relationshipPace", pace)}
              />
            ))}
          </View>
          <NavigationListSection>
            <NavigationListRow
              first
              icon="heart"
              label="Personal values"
              meta="Optional · sharing is controlled in Privacy"
              value={more ? "Hide" : "Add"}
              onPress={() => setMore((v) => !v)}
            />
          </NavigationListSection>
          {more
            ? OPTIONAL_FIELDS.map(([key, label, max]) => (
                <Input
                  key={key}
                  label={label}
                  value={form[key]}
                  onChangeText={(v) => update(key, v)}
                  maxLength={max}
                  placeholder="Optional"
                />
              ))
            : null}
        </>
      )}
    </Screen>
  );
}
