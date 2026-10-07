import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { KeyboardAvoidingView, Modal, Pressable } from "react-native";

const state = vi.hoisted(() => ({ reducedMotion: false, os: "android" }));
vi.mock("react-native", () => ({
  Modal: "Modal",
  View: "View",
  Pressable: "Pressable",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: {
    get OS() {
      return state.os;
    },
  },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5, absoluteFill: {} },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 33, bottom: 24 }),
}));
vi.mock("../../theme/ThemeContext", () => ({ useTheme: () => ({ palette: {} }) }));
vi.mock("../../theme/useReducedMotion", () => ({ useReducedMotion: () => state.reducedMotion }));
import { CenterDialog } from "./CenterDialog";

describe("shared centered dialog", () => {
  it.each(["android", "ios"])(
    "opts forms into keyboard avoidance on %s without changing ordinary dialogs",
    async (os) => {
      state.os = os;
      let view!: ReactTestRenderer;
      await act(async () => {
        view = create(
          <CenterDialog visible onClose={vi.fn()}>
            Content
          </CenterDialog>,
        );
      });
      expect(view.root.findByType(KeyboardAvoidingView).props.enabled).toBe(false);
      await act(async () =>
        view.update(
          <CenterDialog visible keyboardAware onClose={vi.fn()}>
            Content
          </CenterDialog>,
        ),
      );
      const frame = view.root.findByType(KeyboardAvoidingView);
      expect(frame.props.enabled).toBe(true);
      expect(frame.props.behavior).toBe(os === "ios" ? "padding" : "height");
      const dialog = view.root.findByProps({ accessibilityViewIsModal: true });
      expect(dialog.props.style[0].maxHeight).toBe("100%");
      await act(async () => view.unmount());
    },
  );

  it("retains system reduced motion and Back/backdrop/accessible escape dismissal", async () => {
    state.reducedMotion = true;
    const onClose = vi.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <CenterDialog visible onClose={onClose}>
          Content
        </CenterDialog>,
      );
    });
    expect(view.root.findByType(Modal).props.animationType).toBe("none");
    await act(async () => {
      view.root.findByType(Modal).props.onRequestClose();
      view.root.findByType(Pressable).props.onPress();
      view.root.findByProps({ accessibilityViewIsModal: true }).props.onAccessibilityEscape();
    });
    expect(onClose).toHaveBeenCalledTimes(3);
    await act(async () => view.unmount());
    state.reducedMotion = false;
  });
});
