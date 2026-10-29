import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryPreferenceDto } from "../../types/profile";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  catalog: vi.fn(),
  workCatalog: vi.fn(),
  toast: vi.fn(),
  close: vi.fn(),
  saved: vi.fn(),
}));
vi.mock("react-native", () => ({
  View: "View",
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" },
  StyleSheet: { absoluteFill: {} },
  useWindowDimensions: () => ({ width: 393, height: 852 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
vi.mock("../../api/endpoints/profiles", () => ({ profilesApi: { setDiscovery: mocks.save, workCategories: mocks.workCatalog } }));
vi.mock("../../api/endpoints/interests", () => ({ interestsApi: { catalog: mocks.catalog } }));
vi.mock("../../components/layout/Header", () => ({ Header: "Header" }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/Chip", () => ({ Chip: "Chip" }));
vi.mock("../../components/ui/Input", () => ({ Input: "Input" }));
vi.mock("../../components/ui/ToggleRow", () => ({ ToggleRow: "ToggleRow" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/IconButton", () => ({ IconButton: "IconButton" }));
vi.mock("../../components/ui/RangeSlider", () => ({
  RangeSlider: "RangeSlider",
  SingleSlider: "SingleSlider",
}));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../components/ui/Toast", () => ({ useToast: () => ({ show: mocks.toast }) }));
vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ palette: {} }),
  createThemeStyleHook: () => () => ({}),
}));

import { DiscoveryFilterSheet } from "./DiscoveryFilterSheet";

const interestId = "00000000-0000-4000-8000-000000000001";
const preference: DiscoveryPreferenceDto = {
  minAge: 21,
  maxAge: 35,
  maxDistanceKm: 25,
  intentFilter: ["DATING"],
  preferredGenders: ["MAN"],
  includeRecentlyActiveOnly: true,
  preferSameCity: true,
  interestTagIds: [interestId],
  languageFilter: ["Telugu"],
  occupationFilter: "Designer",
  occupationCategoryFilter: ["CREATIVE"],
  smokingFilter: ["NEVER"],
  drinkingFilter: ["SOCIAL"],
  exerciseFilter: ["WEEKLY"],
};

describe("Discovery filter persistence", () => {
  let view: ReactTestRenderer;
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.catalog.mockResolvedValue({
      items: [{ id: interestId, displayName: "Coffee", slug: "coffee", category: null }],
      nextCursor: null,
    });
    mocks.workCatalog.mockResolvedValue([
      { value: "CREATIVE", label: "Creative" },
      { value: "TECHNOLOGY", label: "Technology" },
    ]);
    mocks.save.mockResolvedValue({});
    await act(async () => {
      view = create(
        <DiscoveryFilterSheet
          visible
          initialPreference={preference}
          onClose={mocks.close}
          onSaved={mocks.saved}
        />,
      );
    });
  });
  afterEach(async () => {
    await act(async () => view?.unmount());
  });
  const press = async (label: string) => {
    await act(async () => {
      await view.root.findByProps({ label }).props.onPress();
    });
  };

  it("restores saved filters and saves edits without changing gender preferences", async () => {
    await press("Advanced filters");
    expect(view.root.findByProps({ label: "Work or study" }).props.value).toBe("Designer");
    expect(view.root.findByProps({ label: "Coffee ×" }).props.selected).toBe(true);
    await act(async () => {
      view.root.findByProps({ label: "Work or study" }).props.onChangeText(" Engineer ");
      view.root.findByProps({ label: "Languages" }).props.onChangeText("Telugu, English, telugu");
    });
    await press("Apply filters");
    expect(mocks.save).toHaveBeenCalledWith({
      ...preference,
      occupationFilter: "Engineer",
      languageFilter: ["Telugu", "English"],
    });
    expect(mocks.saved).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("clears optional restrictions with Reset while retaining preferred genders", async () => {
    await press("Reset");
    await press("Apply filters");
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredGenders: ["MAN"],
        interestTagIds: [],
        languageFilter: [],
        occupationFilter: null,
        occupationCategoryFilter: [],
        smokingFilter: [],
        drinkingFilter: [],
        exerciseFilter: [],
        includeRecentlyActiveOnly: false,
        preferSameCity: false,
      }),
    );
  });

  it("hydrates and toggles multiple categories from the shared catalog", async () => {
    await press("Advanced filters");
    expect(view.root.findByProps({ label: "Creative" }).props.selected).toBe(true);
    await press("Technology");
    await press("Creative");
    await press("Apply filters");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ occupationCategoryFilter: ["TECHNOLOGY"] }));
  });

  it("preserves saved categories if catalog loading fails and supports retry", async () => {
    mocks.workCatalog.mockRejectedValueOnce(new Error("Offline"));
    await press("Advanced filters");
    await press("Retry categories");
    expect(view.root.findByProps({ label: "Creative" }).props.selected).toBe(true);
    await press("Apply filters");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ occupationCategoryFilter: ["CREATIVE"] }));
  });

  it("keeps selections open and reports failed saves", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Network unavailable"));
    await press("Apply filters");
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith("Couldn’t save these preferences.", "error");
  });
});
