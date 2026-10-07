import React from "react";
import { Image, Pressable, View } from "react-native";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { PetalGradient } from "../ui/PetalGradient";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { shadows } from "../../theme/shadows";
import type { MessageDto } from "../../types/conversation";
import { formatTimeOfDay } from "../../utils/format";
import { messageMediaSource } from "../../api/messageMedia";

// Mirrors aroha_ui_deisgn_files/chat.jsx > ScreenChat message bubble.
// Own (gradient) vs partner (white surface w/ border) bubble. Own bubble
// shows time + read check, partner bubble shows time only.
export interface MessageBubbleProps {
  message: MessageDto;
  isMine: boolean;
  showRead?: boolean;
  deliveryState?: "sending" | "failed";
  onRetry?: () => void;
  senderName?: string;
  readLabel?: string;
  accessToken?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  showRead,
  deliveryState,
  onRetry,
  senderName,
  readLabel,
  accessToken,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  if (message.status === "DELETED_BY_SENDER") {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubbleBase, styles.systemBubble]}>
          <Text variant="caption" color="textSubdued" style={{ fontStyle: "italic" }}>
            Message deleted
          </Text>
        </View>
      </View>
    );
  }
  if (message.status === "REMOVED_BY_MODERATION") {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubbleBase, styles.systemBubble]}>
          <Text variant="caption" color="warning">
            Message removed by moderation
          </Text>
        </View>
      </View>
    );
  }
  if (message.type === "SYSTEM") {
    return (
      <View style={styles.systemRow}>
        <Text variant="micro" color="textSubdued" align="center">
          {message.textBody}
        </Text>
      </View>
    );
  }

  const isAttachment = message.type !== "TEXT";
  const time = formatTimeOfDay(message.createdAt);

  const bubble = (
    <View style={styles.inner}>
      {senderName && !isMine ? <Text variant="caption" color="textBrand">{senderName}</Text> : null}
      {isAttachment && message.attachment.url ? (
        message.type === "IMAGE" ? (
          <Image
            source={messageMediaSource(message.attachment.url, accessToken)}
            style={styles.attachmentImage}
            resizeMode="cover"
          />
        ) : (
          <Text variant="caption" color={isMine ? "textPrimary" : "textSubdued"}>
            {message.type.toLowerCase()} attachment
          </Text>
        )
      ) : null}
      {message.textBody ? (
        <Text
          variant="body"
          style={{
            color: palette.textPrimary,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {message.textBody}
        </Text>
      ) : null}
      <View style={[styles.metaRow, { justifyContent: "flex-end" }]}>
        <Text
          variant="micro"
          style={{
            fontSize: 12,
            color: palette.textSubdued,
          }}
        >
          {time}
          {message.editedAt ? " · edited" : ""}
          {readLabel ? ` · ${readLabel}` : ""}
        </Text>
        {isMine && showRead ? (
          <Icon
            name="check"
            size={11}
            color={palette.textBrand}
            strokeWidth={2.4}
          />
        ) : null}
        {deliveryState === "sending" ? (
          <Text
            variant="micro"
            style={{
              fontSize: 10,
              color: isMine ? palette.textSubdued : palette.warning,
              marginLeft: 4,
            }}
          >
            sending
          </Text>
        ) : null}
        {deliveryState === "failed" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry sending message"
            hitSlop={8}
            onPress={onRetry}
            style={({ pressed }) => [styles.retryButton, pressed ? styles.retryPressed : null]}
          >
            <Icon name="warning" size={11} color={palette.alwaysWhite} strokeWidth={2} />
            <Text variant="micro" style={styles.retryText}>
              Not sent · Retry
            </Text>
          </Pressable>
        ) : null}
        {message.status === "PENDING_MODERATION" && !deliveryState ? (
          <Text
            variant="micro"
            style={{
              fontSize: 10,
              color: isMine ? palette.textSubdued : palette.warning,
              marginLeft: 4,
            }}
          >
            reviewing
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {isMine ? (
        <PetalGradient tone="soft" style={[styles.bubbleMine, styles.bubbleBase]}>{bubble}</PetalGradient>
      ) : (
        <View style={[styles.bubbleBase, styles.bubbleTheirs, shadows.sm]}>{bubble}</View>
      )}
    </View>
  );
};

// Animated typing-indicator (3 dots).
export const TypingIndicator: React.FC = () => {
  const styles = useStyles();

  return (
    <View style={[styles.row, styles.rowTheirs]}>
      <View style={[styles.bubbleBase, styles.bubbleTheirs, styles.typingBubble]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.typingDot} />
        ))}
      </View>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  row: {
    width: "100%",
    flexDirection: "row",
    marginVertical: 4,
  },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubbleBase: {
    maxWidth: "76%",
    borderRadius: 20,
    overflow: "hidden",
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: palette.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  attachmentImage: {
    width: 180,
    maxWidth: "100%",
    aspectRatio: 0.78,
    borderRadius: 14,
  },
  retryButton: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: palette.errorOverlay,
  },
  retryPressed: { opacity: 0.75 },
  retryText: { color: palette.alwaysWhite, fontSize: 10 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  systemRow: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  systemBubble: {
    backgroundColor: palette.surfaceTint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  typingBubble: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.brand,
    opacity: 0.45,
  },
}));
