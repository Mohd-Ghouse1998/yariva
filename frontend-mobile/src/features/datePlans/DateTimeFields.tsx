import React from "react";
import { StyleSheet, View } from "react-native";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { spacing } from "../../theme/spacing";

interface DateTimeFieldsProps {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export const DateTimeFields: React.FC<DateTimeFieldsProps> = ({
  date,
  time,
  onDateChange,
  onTimeChange,
  error,
  disabled = false,
}) => (
  <View style={styles.container}>
    <View style={styles.row}>
      <Input
        label="Date"
        value={date}
        onChangeText={onDateChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        returnKeyType="next"
        maxLength={10}
        editable={!disabled}
        accessibilityLabel="Date in year month day format"
        containerStyle={styles.field}
      />
      <Input
        label="Time"
        value={time}
        onChangeText={onTimeChange}
        placeholder="18:30"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        maxLength={5}
        editable={!disabled}
        accessibilityLabel="Time in 24-hour format"
        containerStyle={styles.timeField}
      />
    </View>
    {error ? (
      <Text variant="caption" color="error" accessibilityLiveRegion="polite">
        {error}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  field: { flex: 1, minWidth: 0 },
  timeField: { width: 112 },
});
