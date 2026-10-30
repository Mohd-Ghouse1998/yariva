import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type AppLanguage } from "../../localization/translate";

const mocks = vi.hoisted(() => ({ report: vi.fn(), ingest: vi.fn(), back: vi.fn(), toast: { show: vi.fn() }, language: "en" as AppLanguage, targetType: "EVENT_LISTING" }));
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({ targetType: mocks.targetType, targetId: "target-1" }) }));
vi.mock("react-native", () => ({ KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "android", select: (options: Record<string, unknown>) => options.android ?? options.default }, Pressable: "Pressable", ScrollView: "ScrollView", TextInput: "TextInput", View: "View" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../../api/endpoints/safety", () => ({ safetyApi: { report: mocks.report } }));
vi.mock("../../api/endpoints/analytics", () => ({ analyticsApi: { ingest: mocks.ingest } }));
vi.mock("../../components/layout/Header", () => ({ Header: "Header" }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("../../navigation/useSafeBack", () => ({ useSafeBack: () => mocks.back }));
vi.mock("../../localization/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => translate(mocks.language, "standard", key) }) }));
vi.mock("../../theme/ThemeContext", () => ({ useTheme: () => ({ palette: {} }), createThemeStyleHook: (factory: (palette: object) => object) => () => factory({}) }));

import { ReportScreen } from "./ReportScreen";
let view: ReactTestRenderer;
const reasons = () => view.root.findAllByType("Pressable" as React.ElementType).filter(node => node.props.accessibilityRole === "radio");
beforeEach(() => {
  vi.clearAllMocks(); mocks.language = "en"; mocks.targetType = "EVENT_LISTING";
  mocks.report.mockResolvedValue({ isDuplicate: false }); mocks.ingest.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => view?.unmount()); });

describe("localized listing reports through the shared safety flow", () => {
  it.each(["en", "hi", "te"] as const)("shows %s listing-specific copy/reasons and reports an object without blaming a user", async language => {
    mocks.language = language;
    const t = (key: string) => translate(language, "standard", key);
    await act(async () => { view = create(<ReportScreen />); });
    expect(view.root.findByType("Header" as React.ElementType).props.title).toBe(t("events.report.title"));
    expect(reasons().map(node => node.props.accessibilityLabel)).toEqual(["SAFETY_RISK", "SPAM", "INAPPROPRIATE_CONTENT", "OTHER"].map(reason => t(`events.report.reason.${reason}`)));
    await act(async () => reasons()[0]!.props.onPress());
    await act(async () => view.root.findByType("Button" as React.ElementType).props.onPress());
    expect(mocks.report).toHaveBeenCalledWith({ targetType: "EVENT_LISTING", targetEventId: "target-1", reportedUserId: null, reasonCode: "SAFETY_RISK", description: null });
    expect(mocks.toast.show).toHaveBeenCalledWith(t("events.report.success"), "success");
    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing person-report target and reasons", async () => {
    mocks.targetType = "USER";
    await act(async () => { view = create(<ReportScreen />); });
    expect(reasons().map(node => node.props.accessibilityLabel)).toContain("Impersonation");
    await act(async () => reasons()[0]!.props.onPress());
    await act(async () => view.root.findByType("Button" as React.ElementType).props.onPress());
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ targetType: "USER", reportedUserId: "target-1" }));
    expect(mocks.report.mock.calls[0]![0].targetEventId).toBeUndefined();
  });
});
