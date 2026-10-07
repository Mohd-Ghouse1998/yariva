import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../theme/spacing";
import { Button } from "./Button";
import { Text } from "./Text";
import { PetalEmptyAccent } from "./PetalBackdrop";

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
  petalAccent?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  body,
  actionLabel,
  onAction,
  illustration,
  petalAccent = false,
}) => {
  return (
    <View style={styles.wrap}>
      {illustration || petalAccent ? (
        <View style={styles.illustration}>
          {illustration ?? <PetalEmptyAccent />}
        </View>
      ) : null}
      <Text variant="heading" align="center" style={{ marginBottom: spacing.sm }}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="textSubdued" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button label={actionLabel} onPress={onAction} variant="primary" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  illustration: {
    marginBottom: spacing.xl,
  },
});
