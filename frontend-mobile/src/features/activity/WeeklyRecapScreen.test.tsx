import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklyRecap } from "../../types/activity";

const mocks = vi.hoisted(() => ({
  recap: vi.fn(), share: vi.fn(), blur: () => {},
  listeners: new Set<(state: string) => void>(),
}));
vi.mock("expo-router", () => ({ useFocusEffect: (effect: () => (() => void) | void) => React.useEffect(() => {
  const cleanup = effect();
  mocks.blur = () => cleanup?.();
  return cleanup;
}, [effect]) }));
vi.mock("react-native", () => ({
  ScrollView: "ScrollView", View: "View", useWindowDimensions: () => ({ height: 640, fontScale: 1.3 }),
  AppState: { currentState: "active", addEventListener: (_event: string, listener: (state: string) => void) => {
    mocks.listeners.add(listener);
    return { remove: () => mocks.listeners.delete(listener) };
  } },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock("../../api/endpoints/activity", () => ({ activityApi: { recap: mocks.recap } }));
vi.mock("../../components/layout/Header", () => ({ Header: "Header" }));
vi.mock("../../components/profile/useProfileFormLayout", () => ({ useProfileFormLayout: () => ({ content: {} }) }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/Card", () => ({ Card: "Card" }));
vi.mock("../../components/ui/CenterDialog", () => ({ CenterDialog: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? <>{children}</> : null }));
vi.mock("../../components/ui/EmptyState", () => ({ EmptyState: "EmptyState" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/IconButton", () => ({ IconButton: "IconButton" }));
vi.mock("../../components/ui/NavigationList", () => ({ NavigationListSection: "NavigationListSection" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../components/ui/ToggleRow", () => ({ ToggleRow: "ToggleRow" }));
vi.mock("../../components/ui/Toast", () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock("../../notifications/pushRegistration", () => ({ syncPushRegistration: vi.fn() }));
vi.mock("../../navigation/useSafeBack", () => ({ useSafeBack: () => vi.fn() }));
vi.mock("../../theme/ThemeContext", () => ({ useTheme: () => ({ palette: {} }) }));
vi.mock("../../localization/LocalizationContext", async () => {
  const { translate } = await import("../../localization/translate");
  const t = (key: string) => translate("en", "standard", key);
  return { useLocalization: () => ({ t }) };
});
vi.mock("../settings/useSerializedSettings", () => ({ useSerializedSettings: () => ({ value: null }) }));
vi.mock("./exportRecap", () => ({ clearExpiredRecapExports: vi.fn(), shareRecapCard: mocks.share }));
vi.mock("./RecapShareCard", () => ({ RecapShareCard: React.forwardRef(function RecapCard(props, ref) {
  React.useImperativeHandle(ref, () => ({ toDataURL: vi.fn() }));
  return <div {...props} />;
}) }));

import { WeeklyRecapScreen } from "./WeeklyRecapScreen";

const recap: WeeklyRecap = { id: "owned", periodStart: "2026-10-04T14:30:00Z", periodEnd: "2026-10-11T14:30:00Z", version: 1,
  generatedAt: "2026-10-11T14:35:00Z", scenesPublished: 0, plansAccepted: 0, activityDays: 0, pointsEarned: 0,
  historyStartedAt: "2026-10-04T14:30:00Z", partialHistory: false, historyAvailable: true };

describe("weekly recap states and explicit sharing consent", () => {
  let view: ReactTestRenderer | undefined;
  beforeEach(() => { vi.clearAllMocks(); mocks.listeners.clear(); vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback()); });
  afterEach(async () => { await act(async () => view?.unmount()); vi.unstubAllGlobals(); });
  const contents = () => view!.root.findAllByType("Text" as React.ElementType).map(node => node.props.children).join(" ");
  const button = (label: string) => view!.root.findAllByType("Button" as React.ElementType).find(node => node.props.label === label)!;

  it("distinguishes unavailable history from a measured quiet week", async () => {
    mocks.recap.mockResolvedValueOnce({ recap: { ...recap, historyAvailable: false } });
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    expect(contents()).toContain("Your first recap is ahead");
    expect(button("Preview card")).toBeUndefined();
    await act(async () => view!.unmount());
    mocks.recap.mockResolvedValueOnce({ recap });
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    expect(contents()).toContain("quiet");
    expect(button("Preview card")).toBeDefined();
    const values = view!.root.findAllByType("Text" as React.ElementType).filter(node => node.props.children === 0);
    expect(values).toHaveLength(4);
  });

  it("keeps nonzero facts private until opted in and resets the choice for each preview", async () => {
    mocks.recap.mockResolvedValueOnce({ recap: { ...recap, scenesPublished: 2, pointsEarned: 20, activityDays: 1 } });
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    expect(contents()).toContain("your pace");
    await act(async () => button("Preview card").props.onPress());
    const card = () => view!.root.findByType("div").props;
    expect(card().includeMetrics).toBe(false);
    await act(async () => view!.root.findByType("ToggleRow" as React.ElementType).props.onValueChange(true));
    expect(card().includeMetrics).toBe(true);
    expect(card().recap.pointsEarned).toBe(20);
    await act(async () => view!.root.findAllByType("IconButton" as React.ElementType).find(node => node.props.accessibilityLabel === "Close preview")!.props.onPress());
    await act(async () => button("Preview card").props.onPress());
    expect(card().includeMetrics).toBe(false);
  });

  it("offers a fresh read after an API error instead of rendering stale activity", async () => {
    mocks.recap.mockRejectedValueOnce(new Error("Offline"));
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    expect(button("Preview card")).toBeUndefined();
    mocks.recap.mockResolvedValueOnce({ recap });
    await act(async () => view!.root.findByType("EmptyState" as React.ElementType).props.onAction());
    expect(mocks.recap).toHaveBeenCalledTimes(2);
    expect(button("Preview card")).toBeDefined();
  });

  it("removes private preview on background and requires fresh opt-in after a new report", async () => {
    mocks.recap.mockResolvedValueOnce({ recap });
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    await act(async () => button("Preview card").props.onPress());
    await act(async () => view!.root.findByType("ToggleRow" as React.ElementType).props.onValueChange(true));
    await act(async () => mocks.listeners.forEach(listener => listener("background")));
    expect(view!.root.findAllByType("div")).toHaveLength(0);
    expect(button("Preview card")).toBeUndefined();
    let finish!: (value: { recap: WeeklyRecap }) => void;
    mocks.recap.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => mocks.listeners.forEach(listener => listener("active")));
    expect(view!.root.findAllByType("div")).toHaveLength(0);
    await act(async () => finish({ recap: { ...recap, id: "new-week", pointsEarned: 30 } }));
    expect(view!.root.findAllByType("div")).toHaveLength(0);
    await act(async () => button("Preview card").props.onPress());
    expect(view!.root.findByType("div").props.includeMetrics).toBe(false);
    expect(view!.root.findByType("div").props.recap.id).toBe("new-week");
  });

  it("ignores a report response that arrives after backgrounding", async () => {
    let finish!: (value: { recap: WeeklyRecap }) => void;
    mocks.recap.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    await act(async () => mocks.listeners.forEach(listener => listener("background")));
    await act(async () => finish({ recap }));
    expect(button("Preview card")).toBeUndefined();
    expect(contents()).not.toContain("quiet");
  });

  it.each(["blur", "background", "unmount"])("cancels a pending export on %s and deduplicates rapid share taps", async (event) => {
    mocks.recap.mockResolvedValueOnce({ recap });
    let finish!: () => void;
    mocks.share.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    await act(async () => button("Preview card").props.onPress());
    const onPress = button("Share card").props.onPress;
    await act(async () => { onPress(); onPress(); });
    expect(mocks.share).toHaveBeenCalledTimes(1);
    const signal = mocks.share.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    await act(async () => {
      if (event === "unmount") view!.unmount();
      else if (event === "blur") mocks.blur();
      else mocks.listeners.forEach(listener => listener("background"));
    });
    expect(signal.aborted).toBe(true);
    if (event !== "unmount") expect(view!.root.findAllByType("div")).toHaveLength(0);
    await act(async () => finish());
    if (event !== "unmount") expect(view!.root.findAllByType("Text" as React.ElementType).filter(node => node.props.accessibilityRole === "alert")).toHaveLength(0);
  });

  it("cancels before native rendering if the screen is left during the frame wait", async () => {
    const frames: (() => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
    mocks.recap.mockResolvedValueOnce({ recap });
    await act(async () => { view = create(<WeeklyRecapScreen />); });
    await act(async () => button("Preview card").props.onPress());
    await act(async () => button("Share card").props.onPress());
    await act(async () => mocks.blur());
    await act(async () => { frames.shift()!(); frames.shift()!(); });
    expect(mocks.share).not.toHaveBeenCalled();
  });
});
