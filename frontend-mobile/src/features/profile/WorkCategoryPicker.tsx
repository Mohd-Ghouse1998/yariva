import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { profilesApi } from "../../api/endpoints/profiles";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { Text } from "../../components/ui/Text";
import { spacing } from "../../theme/spacing";
import type { OccupationCategory, OccupationCategoryOption } from "../../types/profile";

/** Shared catalog; owners choose one category, discovery may select several. */
export function WorkCategoryPicker({
  selected,
  onChange,
  multiple = false,
  disabled = false,
}: {
  selected: readonly OccupationCategory[];
  onChange: (values: OccupationCategory[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<OccupationCategoryOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    void profilesApi
      .workCategories()
      .then((values) => {
        if (active) {
          setItems(values);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="captionStrong">Work or study category (optional)</Text>
      {status === "loading" ? <Text color="textSubdued">Loading categories…</Text> : null}
      {status === "error" ? (
        <>
          <Text color="error">Couldn’t load work categories.</Text>
          <Button
            label="Retry categories"
            variant="ghost"
            disabled={disabled}
            onPress={() => setAttempt((value) => value + 1)}
          />
        </>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {items.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            selected={selected.includes(value)}
            disabled={disabled}
            onPress={() =>
              onChange(
                selected.includes(value)
                  ? selected.filter((item) => item !== value)
                  : multiple
                    ? [...selected, value]
                    : [value],
              )
            }
          />
        ))}
      </View>
      {multiple ? (
        <Text variant="caption" color="textSubdued">
          Any selected category. Only people who share work details.
        </Text>
      ) : null}
    </View>
  );
}
