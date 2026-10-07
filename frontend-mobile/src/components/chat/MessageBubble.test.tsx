import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { MessageDto } from "../../types/conversation";
vi.mock("../../utils/env", () => ({ env: { apiBaseUrl: "http://localhost:3001/api/v1" } }));

vi.mock("react-native", () => ({
  Image: "Image",
  Pressable: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(
      "Pressable",
      props,
      typeof children === "function"
        ? (children as (state: { pressed: boolean }) => React.ReactNode)({ pressed: false })
        : children,
    ),
  StyleSheet: { absoluteFill: {}, create: <Styles,>(styles: Styles) => styles },
  View: "View",
}));

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("LinearGradient", props, children),
}));

vi.mock("../../theme/ThemeContext", () => {
  const palette = {
    alwaysWhite: "#fff",
    border: "#ddd",
    blendSoftStart: "#fff0e9",
    blendSoftEnd: "#ffe4ec",
    brand: "#292321",
    errorOverlay: "#a14652",
    surface: "#fff",
    surfaceTint: "#f5f0e9",
    textOnBrand: "#on-brand",
    textPrimary: "#292321",
    textBrand: "#b91f55",
    textSubdued: "#746b65",
    warning: "#8d5f25",
    whiteAlpha70: "rgba(255,255,255,0.70)",
    whiteAlpha85: "rgba(255,255,255,0.85)",
  };

  return {
    useTheme: () => ({ palette }),
    createThemeStyleHook: (factory: (colors: typeof palette) => Record<string, unknown>) =>
      () => factory(palette),
  };
});

vi.mock("../ui/Icon", () => ({
  Icon: (props: Record<string, unknown>) => React.createElement("Icon", props),
}));

vi.mock("../ui/Text", () => ({
  Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("Text", props, children),
}));

import { MessageBubble } from "./MessageBubble";

const failedMessage: MessageDto = {
  id: "optimistic-1",
  conversationId: "conversation-1",
  senderId: "user-1",
  sequence: 1.5,
  clientMessageId: "optimistic-1",
  type: "TEXT",
  textBody: "Please retry me",
  attachment: {
    objectKey: null,
    url: null,
    mimeType: null,
    sizeBytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    moderationStatus: null,
  },
  status: "PENDING_MODERATION",
  replyToMessageId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: "2026-08-09T10:00:00.000Z",
  updatedAt: "2026-08-09T10:00:00.000Z",
};

describe("MessageBubble delivery state", () => {
  it("uses a shared soft blend and readable text for an outgoing bubble", async () => {
    let renderer: ReturnType<typeof create> | undefined;

    await act(async () => {
      renderer = create(<MessageBubble message={failedMessage} isMine />);
    });

    const messageText = renderer?.root.findByProps({ children: "Please retry me" });
    expect(messageText?.props.style).toMatchObject({ color: "#292321" });
    expect(renderer?.root.findAll((node) => node.props.colors?.[0] === "#fff0e9")[0]?.props.colors).toEqual(["#fff0e9", "#ffe4ec"]);
  });

  it("renders an accessible Retry action for a failed optimistic message", async () => {
    const onRetry = vi.fn();
    let renderer: ReturnType<typeof create> | undefined;

    await act(async () => {
      renderer = create(
        <MessageBubble
          message={failedMessage}
          isMine
          deliveryState="failed"
          onRetry={onRetry}
        />,
      );
    });

    const retry = renderer?.root.findByProps({
      accessibilityLabel: "Retry sending message",
    });
    expect(retry).toBeDefined();

    await act(async () => {
      retry?.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
