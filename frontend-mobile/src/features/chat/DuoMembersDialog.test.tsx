import React from "react";
import { Pressable } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Button } from "../../components/ui/Button";

vi.mock("react-native", () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
}));
vi.mock("../../components/ui/CenterDialog", () => ({ CenterDialog: "CenterDialog" }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button", ButtonRow: "ButtonRow" }));
vi.mock("../../components/ui/IconButton", () => ({ IconButton: "IconButton" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ palette: { error: "error", errorSubdued: "errorSubdued", textBrand: "textBrand", textSecondary: "textSecondary" } }),
  createThemeStyleHook: (factory: (palette: object) => object) => () =>
    factory({ errorSubdued: "errorSubdued", brandSubdued: "brandSubdued", surfaceTint: "surfaceTint", divider: "divider" }),
}));
vi.mock("../../localization/LocalizationContext", () => ({
  useLocalization: () => ({ tone: "neutral", t: (key: string) => key }),
}));

import { DuoMembersDialog } from "./DuoMembersDialog";
import { BlockConfirmModal } from "../safety/BlockConfirmModal";
import type { PublicProfileDto } from "../../types/profile";

// Only identity is consumed by these dialogs; no fabricated full profile is needed.
const members = ["You", "Asha", "Rohan", "Meera"].map((displayName, index) => ({
  userId: `member-${index}`,
  displayName,
})) as PublicProfileDto[];

describe("Duo member safety disclosure", () => {
  it("starts with four member rows, no repeated Report/Block buttons and no self action", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <DuoMembersDialog
          visible
          members={members}
          currentUserId="member-0"
          onClose={vi.fn()}
          onReport={vi.fn()}
          onBlock={vi.fn()}
        />,
      );
    });
    const rows = view.root.findAllByType(Pressable).filter((row) => row.props.accessibilityLabel?.includes("Safety options") || row.props.accessibilityLabel?.endsWith(", You"));
    expect(rows).toHaveLength(4);
    expect(rows[0].props.disabled).toBe(true);
    expect(view.root.findAllByType(Button)).toHaveLength(0);
    await act(async () => view.unmount());
  });

  it("reports or blocks only the selected current participant, without a second member page", async () => {
    const onReport = vi.fn();
    const onBlock = vi.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <DuoMembersDialog
          visible
          members={members}
          currentUserId="member-0"
          onClose={vi.fn()}
          onReport={onReport}
          onBlock={onBlock}
        />,
      );
    });
    await act(async () =>
      view.root.findByProps({ accessibilityLabel: "Safety options for Asha" }).props.onPress(),
    );
    expect(view.root.findAllByType(CenterDialog)).toHaveLength(1);
    await act(async () => view.root.findByProps({ accessibilityLabel: "Report Asha" }).props.onPress());
    expect(onReport).toHaveBeenCalledWith(members[1]);
    await act(async () =>
      view.root.findByProps({ accessibilityLabel: "Safety options for Meera" }).props.onPress(),
    );
    expect(view.root.findAllByProps({ accessibilityLabel: "Block Asha" })).toHaveLength(0);
    await act(async () => view.root.findByProps({ accessibilityLabel: "Block Meera" }).props.onPress());
    expect(onBlock).toHaveBeenCalledWith(members[3]);
    await act(async () => view.unmount());
  });

  it("clears disclosure on close and ignores a participant removed from the current list", async () => {
    const props = {
      members,
      currentUserId: "member-0",
      onClose: vi.fn(),
      onReport: vi.fn(),
      onBlock: vi.fn(),
    };
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<DuoMembersDialog {...props} visible />);
    });
    await act(async () =>
      view.root.findByProps({ accessibilityLabel: "Safety options for Asha" }).props.onPress(),
    );
    await act(async () =>
      view.update(
        <DuoMembersDialog
          {...props}
          visible
          members={members.filter((member) => member.userId !== "member-1")}
        />,
      ),
    );
    expect(view.root.findAllByProps({ accessibilityLabel: "Block Asha" })).toHaveLength(0);
    await act(async () => view.update(<DuoMembersDialog {...props} visible={false} />));
    await act(async () => view.update(<DuoMembersDialog {...props} visible />));
    expect(view.root.findAllByType(Pressable).filter((row) => row.props.accessibilityLabel?.includes("Safety options") || row.props.accessibilityLabel?.endsWith(", You"))).toHaveLength(4);
    await act(async () => view.root.findByProps({ accessibilityLabel: "Close members and safety" }).props.onPress());
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onReport).not.toHaveBeenCalled();
    expect(props.onBlock).not.toHaveBeenCalled();
    await act(async () => view.unmount());
  });
});

describe("shared centered block confirmation", () => {
  it("retains explicit confirmation and cancel without executing either on open", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <BlockConfirmModal visible displayName="Asha" onCancel={onCancel} onConfirm={onConfirm} />,
      );
    });
    expect(view.root.findByType(CenterDialog).props.accessibilityLabel).toBe("Block Asha?");
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => view.root.findByProps({ label: "Cancel" }).props.onPress());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => view.root.findByProps({ label: "Block Asha" }).props.onPress());
    expect(onConfirm).toHaveBeenCalledOnce();
    await act(async () => view.unmount());
  });

  it("prevents dismissal and duplicate confirmation while the existing request is busy", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <BlockConfirmModal
          visible
          busy
          displayName="Asha"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      );
    });
    expect(view.root.findByProps({ label: "Cancel" }).props.disabled).toBe(true);
    await act(async () => {
      view.root.findByType(CenterDialog).props.onClose();
      view.root.findByProps({ label: "Cancel" }).props.onPress();
      view.root.findByProps({ label: "Block Asha" }).props.onPress();
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => view.unmount());
  });
});
