import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityPreferences } from "../../api/endpoints/privateStories";
import { Alert } from "react-native";

const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  mine: vi.fn(),
  saved: vi.fn(),
  setSaved: vi.fn(),
  connections: vi.fn(),
  detail: vi.fn(),
  community: vi.fn(),
  save: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
  remove: vi.fn(),
  preview: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  permission: vi.fn(),
  pickMedia: vi.fn(),
  initiateMedia: vi.fn(),
  upload: vi.fn(),
  platform: { OS: "android" },
  keyboardListeners: new Map<string, (event: { endCoordinates: { screenY: number } }) => void>(),
  capabilities: vi.fn(),
  sceneCapabilities: vi.fn(),
  sceneMine: vi.fn(),
  sceneCreate: vi.fn(),
  sceneUpdate: vi.fn(),
  dispatch: vi.fn(),
  prevent: vi.fn(),
  account: { id: "account-a", status: "ACTIVE" },
  stackContent: null as React.ReactNode,
  params: {} as { storyId?: string; compose?: string; mode?: string },
  setParams: vi.fn(),
  app: { currentState: "active", listener: undefined as ((state: string) => void) | undefined },
}));
vi.mock("expo-router", () => ({
  Stack: Object.assign(() => mocks.stackContent, { Screen: "StackScreen" }),
  Redirect: "Redirect",
  useRouter: () => ({ back: mocks.back, push: mocks.push, setParams: mocks.setParams }),
  useLocalSearchParams: () => mocks.params,
  useFocusEffect: (effect: () => (() => void) | void) => React.useEffect(effect, [effect]),
}));
vi.mock("expo-router/react-navigation", () => ({
  useNavigation: () => ({ dispatch: mocks.dispatch }),
  usePreventRemove: mocks.prevent,
}));
vi.mock("../../api/endpoints/scenes", () => ({
  scenesApi: {
    capabilities: mocks.sceneCapabilities,
    mine: mocks.sceneMine,
    create: mocks.sceneCreate,
    update: mocks.sceneUpdate,
  },
}));
vi.mock("../scenes/SceneComposerSheet", () => ({ SceneComposerSheet: "SceneComposerSheet" }));
vi.mock("../../components/dating", () => ({ SegmentedControl: "SegmentedControl" }));
vi.mock("../../api/upload", () => ({ uploadToPresignedUrl: mocks.upload }));
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: mocks.account,
    profileCompletion: { isComplete: true },
  }),
}));
vi.mock("../../notifications/PushRegistrationEffect", () => ({
  PushRegistrationEffect: () => null,
}));
vi.mock("../errors/AccountRestrictedScreen", () => ({
  AccountRestrictedScreen: "AccountRestrictedScreen",
}));
vi.mock("../auth/SplashScreen", () => ({ SplashScreen: "SplashScreen" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: mocks.permission,
  launchImageLibraryAsync: mocks.pickMedia,
}));
vi.mock("expo-file-system", () => ({
  File: class {
    size = 32;
  },
}));
vi.mock("expo-video", () => ({ useVideoPlayer: vi.fn(), VideoView: "VideoView" }));
vi.mock("./PrivateStoryViewer", () => ({ PrivateStoryViewer: "PrivateStoryViewer" }));
vi.mock("react-native", () => ({
  ScrollView: "ScrollView",
  Pressable: "Pressable",
  View: "View",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  Keyboard: {
    dismiss: vi.fn(),
    metrics: vi.fn(),
    addListener: (name: string, listener: (event: { endCoordinates: { screenY: number } }) => void) => {
      mocks.keyboardListeners.set(name, listener);
      return { remove: () => mocks.keyboardListeners.delete(name) };
    },
  },
  TextInput: "TextInput",
  Platform: {
    get OS() {
      return mocks.platform.OS;
    },
    select: (options: { android: unknown }) => options.android,
  },
  Alert: { alert: vi.fn() },
  StyleSheet: { create: (value: object) => value },
  AppState: {
    get currentState() {
      return mocks.app.currentState;
    },
    addEventListener: (_: string, listener: (state: string) => void) => {
      mocks.app.listener = listener;
      return {
        remove: () => {
          mocks.app.listener = undefined;
        },
      };
    },
  },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../../api/endpoints/privateStories", () => ({
  privateStoriesApi: {
    capabilities: mocks.capabilities,
    update: mocks.update,
    remove: mocks.remove,
    feed: mocks.feed,
    mine: mocks.mine,
    saved: mocks.saved,
    setSaved: mocks.setSaved,
    connections: mocks.connections,
    detail: mocks.detail,
    community: mocks.community,
    saveCommunity: mocks.save,
    preview: mocks.preview,
    create: mocks.create,
    initiateMedia: mocks.initiateMedia,
  },
  communityLabels: [{ value: "GAY" }, { value: "QUEER" }],
}));
vi.mock("../../components/ui/Button", () => ({
  Button: ({ leftIcon, rightIcon, ...props }: import("../../components/ui/Button").ButtonProps) =>
    React.createElement("Button", props, leftIcon, rightIcon),
}));
vi.mock("../../components/ui/Input", () => ({ Input: "Input" }));
vi.mock("../../components/ui/NavigationList", () => ({ NavigationListRow: "NavigationListRow" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../theme/ThemeContext", () => ({ useTheme: () => ({ palette: {} }) }));
vi.mock("../../theme/responsive", () => ({ useResponsiveLayout: () => ({}) }));
vi.mock("../../localization/LocalizationContext", async () => {
  const { translate } = await import("../../localization/translate");
  const t = (key: string, params?: Record<string, string | number>) =>
    translate("en", "standard", key, params);
  return { useLocalization: () => ({ t }) };
});

import AppLayout from "../../../app/(app)/_layout";
import { usePrivateStoryRail } from "./PrivateStoriesRail";
import { CommunityPrivacyScreen } from "./CommunityPrivacyScreen";
import { PrivateStoriesScreen } from "./PrivateStoriesScreen";

const Rail = ({ enabled = true }) =>
  React.createElement("rail-state", { data: usePrivateStoryRail(enabled) });
const choices: CommunityPreferences = {
  identifyAs: ["GAY"],
  connectWith: ["QUEER"],
  optedInCommunities: [],
  selfDescription: null,
};

describe("private Story cached data and consent", () => {
  let view: ReactTestRenderer | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.keyboardListeners.clear();
    mocks.account = { id: "account-a", status: "ACTIVE" };
    mocks.stackContent = null;
    mocks.app.currentState = "active";
    mocks.platform.OS = "android";
    mocks.permission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.pickMedia.mockResolvedValue({ canceled: true, assets: null });
    mocks.initiateMedia.mockResolvedValue({
      uploadUrl: "https://storage.test/private-upload",
      objectKey: "private-upload",
      uploadToken: "test-token",
      mimeType: "image/jpeg",
      sizeBytes: 32,
    });
    mocks.upload.mockResolvedValue(undefined);
    mocks.params = {};
    mocks.capabilities.mockResolvedValue({ enabled: true });
    mocks.sceneCapabilities.mockResolvedValue({
      enabled: true,
      lifetimeHours: 12,
      radiusMeters: 15000,
    });
    mocks.sceneMine.mockResolvedValue({ scene: null });
    mocks.mine.mockResolvedValue({ items: [] });
    mocks.saved.mockResolvedValue({ items: [], nextCursor: null });
    mocks.feed.mockResolvedValue({ items: [], nextCursor: null });
    mocks.connections.mockResolvedValue({ people: [], recipientIds: [] });
    mocks.preview.mockResolvedValue({ eligibleCount: 1, lifetimeHours: 24 });
    mocks.create.mockResolvedValue({ story: { moderationStatus: "APPROVED" } });
    mocks.update.mockResolvedValue({ story: { moderationStatus: "APPROVED" } });
    mocks.remove.mockResolvedValue(undefined);
    mocks.setParams.mockImplementation((params: { storyId?: string }) => {
      mocks.params = { ...mocks.params, ...params };
    });
  });
  afterEach(async () => {
    await act(async () => view?.unmount());
  });
  const state = (name: string) => {
    mocks.app.currentState = name;
    mocks.app.listener?.(name);
  };
  const data = () => view!.root.findByType("rail-state" as React.ElementType).props.data;
  const row = (label: string) =>
    view!.root
      .findAllByType("NavigationListRow" as React.ElementType)
      .find((item) => item.props.label === label)!;
  const openOptions = async (index = 0) => {
    await act(async () => {
      view!.root
        .findAllByType("Pressable" as React.ElementType)
        .filter((button) => button.props.accessibilityLabel === "Story options")
        [index]!.props.onPress();
    });
  };
  const ownStory = (id: string, moderationStatus = "APPROVED") => ({
    id,
    text: `Private ${id}`,
    mediaMimeType: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    moderationStatus,
  });

  const selectCollection = async (value: "mine" | "saved") => {
    await act(async () => {
      view!.root
        .findAllByType("SegmentedControl" as React.ElementType)
        .find((tab) => tab.props.accessibilityLabel === "Story collection")!
        .props.onChange(value);
    });
  };

  it("persists optional saves after reload and unsaves active Stories without removing them", async () => {
    const active = ownStory("active");
    mocks.mine.mockResolvedValue({ items: [active] });
    const saved = { ...active, savedAt: new Date().toISOString() };
    mocks.setSaved
      .mockResolvedValueOnce({ story: saved })
      .mockResolvedValueOnce({ story: { ...active, savedAt: null } });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await openOptions();
    expect(row("Save to archive")).toBeDefined();
    await act(async () => {
      row("Save to archive").props.onPress();
    });
    expect(mocks.setSaved).toHaveBeenCalledWith("active", true);
    expect(row("Remove from saved")).toBeDefined();
    expect(
      view!.root.findAllByProps({ accessibilityLabel: "Saved to your private archive" }).length,
    ).toBe(1);
    mocks.mine.mockResolvedValue({ items: [saved] });
    await act(async () => {
      state("background");
    });
    await act(async () => {
      state("active");
    });
    await openOptions();
    expect(row("Remove from saved")).toBeDefined();
    await act(async () => {
      row("Remove from saved").props.onPress();
    });
    expect(mocks.setSaved).toHaveBeenLastCalledWith("active", false);
    expect(row("Save to archive")).toBeDefined();
    expect(JSON.stringify(view!.toJSON())).toContain("Private active");
  });

  it("groups saved Stories by original posting month and removes an expired unsaved row", async () => {
    const archived = {
      ...ownStory("old"),
      createdAt: "2026-01-10T12:00:00Z",
      expiresAt: "2026-01-11T12:00:00Z",
      savedAt: new Date().toISOString(),
    };
    mocks.saved.mockResolvedValue({
      items: [archived, { ...archived, id: "older", createdAt: "2025-12-20T12:00:00Z" }],
    });
    mocks.setSaved.mockResolvedValue({ story: { ...archived, savedAt: null } });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await selectCollection("saved");
    expect(JSON.stringify(view!.toJSON())).toContain("January 2026");
    expect(JSON.stringify(view!.toJSON())).toContain("December 2025");
    await openOptions();
    expect(row("Edit audience")).toBeUndefined();
    await act(async () => {
      row("Remove from saved").props.onPress();
    });
    expect(JSON.stringify(view!.toJSON())).not.toContain("January 2026");
    expect(JSON.stringify(view!.toJSON())).toContain("December 2025");
  });

  it("shows Saved loading, error and empty states and rejects an old tab's pending page", async () => {
    mocks.mine.mockResolvedValue({ items: [ownStory("active")], nextCursor: "old-page" });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    let finishPage!: (value: object) => void, finishSaved!: (value: object) => void;
    mocks.mine.mockReturnValueOnce(
      new Promise((resolve) => {
        finishPage = resolve;
      }),
    );
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "More of your Stories")!
        .props.onPress();
    });
    mocks.saved.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSaved = resolve;
      }),
    );
    await selectCollection("saved");
    expect(JSON.stringify(view!.toJSON())).toContain("Loading your Stories");
    await act(async () => {
      finishPage({ items: [ownStory("stale")], nextCursor: null });
      finishSaved({ items: [], nextCursor: null });
    });
    expect(JSON.stringify(view!.toJSON())).not.toContain("Private stale");
    expect(JSON.stringify(view!.toJSON())).toContain("No saved Stories");
    await selectCollection("mine");
    mocks.saved.mockRejectedValueOnce(new Error("offline"));
    await selectCollection("saved");
    expect(JSON.stringify(view!.toJSON())).toContain("Try loading again");
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "Try loading again")!
        .props.onPress();
    });
    expect(JSON.stringify(view!.toJSON())).toContain("No saved Stories");
  });

  it("prevents duplicate save requests and keeps persisted state after a save error", async () => {
    mocks.mine.mockResolvedValue({ items: [ownStory("active")] });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await openOptions();
    let reject!: (error: Error) => void;
    mocks.setSaved.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    await act(async () => {
      row("Save to archive").props.onPress();
      row("Save to archive").props.onPress();
    });
    expect(mocks.setSaved).toHaveBeenCalledOnce();
    expect(row("Save to archive").props.disabled).toBe(true);
    await act(async () => {
      reject(new Error("offline"));
    });
    expect(row("Save to archive").props.disabled).toBe(false);
    expect(row("Remove from saved")).toBeUndefined();
    expect(view!.root.findAllByProps({ accessibilityRole: "alert" }).length).toBeGreaterThan(0);
  });

  it("opens owned Stories from the gallery and keeps management actions in their options", async () => {
    mocks.mine.mockResolvedValue({ items: [ownStory("own")] });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    expect(row("Delete Story")).toBeUndefined();
    await act(async () => {
      view!.root
        .findAllByType("Pressable" as React.ElementType)
        .find((button) => button.props.accessibilityLabel === "View Story")!
        .props.onPress();
    });
    const viewer = () => view!.root.findByType("PrivateStoryViewer" as React.ElementType);
    expect(viewer().props.storyId).toBe("own");
    await act(async () => {
      viewer().props.onClose();
    });
    await openOptions();
    expect(row("Edit audience")).toBeDefined();
    await act(async () => {
      row("Delete Story").props.onPress();
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(row("Delete Story")).toBeDefined();
    const confirmation = vi.mocked(Alert.alert).mock.calls.at(-1)!;
    expect(confirmation[0]).toBe("Delete this Story?");
    await act(async () => {
      confirmation[2]!.find((button) => button.style === "destructive")!.onPress?.();
    });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("own");
  });

  it("shows review states, excludes rejected edits and clears an open options sheet on background", async () => {
    mocks.mine.mockResolvedValue({
      items: [ownStory("pending", "PENDING"), ownStory("rejected", "REJECTED")],
    });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    expect(JSON.stringify(view!.toJSON())).toContain("Awaiting review · only you");
    expect(JSON.stringify(view!.toJSON())).toContain("Not shared · did not pass review");
    const storyActions = view!.root
      .findAllByType("Pressable" as React.ElementType)
      .filter((button) => button.props.accessibilityLabel === "View Story");
    expect(storyActions[0].props.accessibilityHint).toContain("Only you can see this");
    expect(storyActions[1].props.accessibilityHint).toContain("Not shared. Did not pass review");
    expect(
      storyActions.every((button) => button.props.accessibilityHint.includes("Expires ")),
    ).toBe(true);
    await openOptions(1);
    expect(row("Edit audience")).toBeUndefined();
    expect(row("Delete Story")).toBeDefined();
    await act(async () => {
      state("background");
    });
    expect(row("Delete Story")).toBeUndefined();
    expect(JSON.stringify(view!.toJSON())).not.toContain("Private rejected");
  });

  it("does not persist gallery previews or expose unapproved media, and falls back on URL failure", async () => {
    mocks.mine.mockResolvedValue({
      items: [
        { ...ownStory("approved"), previewUrl: "https://private.test/approved" },
        { ...ownStory("pending", "PENDING"), previewUrl: "https://private.test/pending" },
      ],
    });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    const images = () => view!.root.findAllByType("Image" as React.ElementType);
    expect(images()).toHaveLength(1);
    expect(images()[0].props.cachePolicy).toBe("none");
    expect(images()[0].props.source.uri).toBe("https://private.test/approved");
    await act(async () => {
      images()[0].props.onError();
    });
    expect(images()).toHaveLength(0);
    expect(JSON.stringify(view!.toJSON())).toContain("Private approved");
  });

  it("keeps connections and privacy reachable from Story management", async () => {
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await act(async () => {
      for (const label of ["Followers and following", "Community privacy"]) {
        view!.root
          .findAllByType("Pressable" as React.ElementType)
          .find((button) => button.props.accessibilityLabel === label)!
          .props.onPress();
      }
    });
    expect(mocks.push.mock.calls).toEqual([
      ["/(app)/private-stories/follows"],
      ["/(app)/private-stories/community"],
    ]);
  });

  it("clears the rail on background, discards stale results and rechecks revoked access", async () => {
    mocks.feed.mockResolvedValueOnce({ items: [{ id: "private" }] });
    mocks.mine.mockResolvedValue({ items: [] });
    await act(async () => {
      view = create(<Rail />);
    });
    expect(data().items).toEqual([{ id: "private" }]);
    await act(async () => {
      state("background");
    });
    expect(data().items).toEqual([]);
    let finish!: (page: { items: { id: string }[] }) => void;
    mocks.feed.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      state("active");
    });
    await act(async () => {
      state("inactive");
      finish({ items: [{ id: "stale" }] });
    });
    expect(data().items).toEqual([]);
    mocks.feed.mockResolvedValueOnce({ items: [] });
    await act(async () => {
      state("active");
    });
    expect(data().items).toEqual([]);
    expect(mocks.feed).toHaveBeenCalledTimes(3);
  });

  it("resets private state on account change and rejects the previous account's delayed page", async () => {
    let finish!: (page: { items: { id: string }[] }) => void;
    mocks.feed.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mocks.mine.mockResolvedValue({ items: [] });
    mocks.stackContent = <Rail />;
    await act(async () => {
      view = create(<AppLayout />);
    });
    mocks.account = { id: "account-b", status: "ACTIVE" };
    mocks.feed.mockResolvedValueOnce({ items: [{ id: "account-b-story" }] });
    await act(async () => {
      view!.update(<AppLayout />);
    });
    expect(data().items).toEqual([{ id: "account-b-story" }]);
    await act(async () => {
      finish({ items: [{ id: "account-a-private-story" }] });
    });
    expect(data().items).toEqual([{ id: "account-b-story" }]);
    expect(mocks.feed).toHaveBeenCalledTimes(2);
  });

  it("does not fetch a disabled rail and offers retry after a failed read", async () => {
    await act(async () => {
      view = create(<Rail enabled={false} />);
    });
    expect(mocks.feed).not.toHaveBeenCalled();
    mocks.feed.mockRejectedValueOnce(new Error("Offline"));
    mocks.mine.mockResolvedValue({ items: [] });
    await act(async () => {
      view!.update(<Rail />);
    });
    expect(data().loadError).toBe(true);
    mocks.feed.mockResolvedValueOnce({ items: [] });
    await act(async () => {
      data().retry();
    });
    expect(data().loadError).toBe(false);
  });

  it("saves identity and interests independently without opting into community Stories", async () => {
    mocks.community.mockResolvedValue(choices);
    mocks.save.mockResolvedValue(choices);
    await act(async () => {
      view = create(<CommunityPrivacyScreen />);
    });
    const rows = view!.root.findAllByType("NavigationListRow" as React.ElementType);
    expect(rows.map((row) => row.props.selected)).toEqual([true, false, false, true, false, false]);
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "Save private choices")!
        .props.onPress();
    });
    expect(mocks.save).toHaveBeenCalledWith(choices);
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it("clears management lists and discards an in-flight page before rechecking access", async () => {
    mocks.mine.mockResolvedValue({ items: [] });
    mocks.connections.mockResolvedValue({ people: [] });
    mocks.feed.mockResolvedValueOnce({
      items: [
        {
          id: "visible",
          ownerName: "Private connection",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      ],
      nextCursor: "next",
    });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    expect(JSON.stringify(view!.toJSON())).toContain("Private connection");
    let finish!: (page: { items: { id: string; ownerName: string }[]; nextCursor: null }) => void;
    mocks.feed.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "More Stories")!
        .props.onPress();
    });
    await act(async () => {
      state("background");
      finish({ items: [{ id: "stale", ownerName: "Stale connection" }], nextCursor: null });
    });
    expect(JSON.stringify(view!.toJSON())).not.toMatch(/Private connection|Stale connection/);
    mocks.feed.mockResolvedValueOnce({ items: [], nextCursor: null });
    await act(async () => {
      state("active");
    });
    expect(JSON.stringify(view!.toJSON())).not.toMatch(
      /Private connection|Stale connection|More Stories/,
    );
    expect(mocks.feed.mock.calls).toEqual([[], ["next"], []]);
  });

  it("loads older owned Stories once, retries failures and discards stale owner pages", async () => {
    const story = (id: string) => ({
      id,
      text: `Private ${id}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      moderationStatus: "APPROVED",
    });
    mocks.mine.mockResolvedValueOnce({ items: [story("first")], nextCursor: "older" });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    const more = () =>
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "More of your Stories")!;
    mocks.mine.mockRejectedValueOnce(new Error("Offline"));
    await act(async () => {
      more().props.onPress();
      more().props.onPress();
    });
    expect(mocks.mine.mock.calls).toEqual([[], ["older"]]);
    expect(JSON.stringify(view!.toJSON())).toContain("Private first");
    expect(JSON.stringify(view!.toJSON())).toContain("Couldn’t load more");
    mocks.mine.mockResolvedValueOnce({
      items: [story("first"), story("second")],
      nextCursor: "last",
    });
    await act(async () => {
      more().props.onPress();
    });
    expect(
      view!.root
        .findAllByType("Pressable" as React.ElementType)
        .filter((button) => button.props.accessibilityLabel === "Story options"),
    ).toHaveLength(2);
    expect(view!.root.findAllByProps({ accessibilityLabel: "Delete Story" })).toHaveLength(0);
    let finish!: (page: object) => void;
    mocks.mine.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      more().props.onPress();
    });
    await act(async () => {
      state("background");
      finish({ items: [story("stale")], nextCursor: null });
    });
    expect(JSON.stringify(view!.toJSON())).not.toMatch(
      /Private first|Private second|Private stale|More of your Stories/,
    );
    mocks.mine.mockResolvedValueOnce({ items: [], nextCursor: null });
    await act(async () => {
      state("active");
    });
    expect(JSON.stringify(view!.toJSON())).not.toMatch(
      /Private first|Private second|Private stale|More of your Stories/,
    );
    expect(mocks.mine.mock.calls).toEqual([[], ["older"], ["older"], ["last"], []]);
  });

  it.each([
    ["mine", "More of your Stories"],
    ["feed", "More Stories"],
  ] as const)(
    "keeps a failed %s page beside its retry without reloading the list",
    async (list, label) => {
      const first = {
        id: "first",
        text: "Loaded Story",
        ownerName: "Approved connection",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        moderationStatus: "APPROVED",
      };
      mocks[list].mockResolvedValueOnce({ items: [first], nextCursor: "older" });
      await act(async () => {
        view = create(<PrivateStoriesScreen />);
      });
      const more = () =>
        view!.root
          .findAllByType("Button" as React.ElementType)
          .find((button) => button.props.label === label)!;
      mocks[list].mockRejectedValueOnce(new Error("Offline"));
      await act(async () => {
        more().props.onPress();
      });
      const alert = view!.root.findByProps({ accessibilityRole: "alert" });
      expect(alert.props.children).toContain("Couldn’t load more");
      // The recovery control belongs with this page error, not above the long list.
      expect(
        alert
          .parent!.findAllByType("Button" as React.ElementType)
          .map((button) => button.props.label),
      ).toEqual([label]);
      expect(view!.root.findAllByProps({ label: "Try loading again" })).toHaveLength(0);
      mocks[list].mockResolvedValueOnce({ items: [{ ...first, id: "second" }], nextCursor: null });
      await act(async () => {
        more().props.onPress();
      });
      expect(mocks[list].mock.calls).toEqual([[], ["older"], ["older"]]);
      expect(view!.root.findAllByProps({ accessibilityRole: "alert" })).toHaveLength(0);
      expect(more()).toBeUndefined();
    },
  );

  it("consumes a Story link so opening the same link again reopens the viewer", async () => {
    mocks.mine.mockResolvedValue({ items: [] });
    mocks.connections.mockResolvedValue({ people: [] });
    mocks.feed.mockResolvedValue({ items: [], nextCursor: null });
    mocks.params = { storyId: "linked-story" };
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    const viewer = () => view!.root.findByType("PrivateStoryViewer" as React.ElementType);
    expect(viewer().props.storyId).toBe("linked-story");
    expect(mocks.setParams).toHaveBeenCalledWith({ storyId: undefined });
    await act(async () => {
      viewer().props.onClose();
    });
    expect(viewer().props.storyId).toBeNull();
    mocks.params = { storyId: "linked-story" };
    await act(async () => {
      view!.update(<PrivateStoriesScreen />);
    });
    expect(viewer().props.storyId).toBe("linked-story");
    await act(async () => {
      state("background");
    });
    expect(viewer().props.storyId).toBeNull();
  });

  it("does not reopen a fetched edit after the screen backgrounds", async () => {
    mocks.mine.mockResolvedValue({
      items: [
        {
          id: "own",
          text: "Private caption",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          moderationStatus: "APPROVED",
        },
      ],
    });
    mocks.connections.mockResolvedValue({ people: [] });
    mocks.feed.mockResolvedValue({ items: [], nextCursor: null });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    let finish!: (detail: object) => void;
    mocks.detail.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await openOptions();
    await act(async () => {
      row("Edit audience").props.onPress();
    });
    await act(async () => {
      state("background");
      finish({
        story: { text: "Fetched secret", mediaUrl: "private-url", mediaMimeType: "image/png" },
        recipientIds: [],
      });
    });
    expect(JSON.stringify(view!.toJSON())).not.toMatch(
      /Private caption|Fetched secret|private-url/,
    );
    expect(view!.root.findAllByType("TextInput" as React.ElementType)).toHaveLength(0);
  });

  const compose = async (initialCollection: "mine" | "saved" = "mine") => {
    mocks.mine.mockResolvedValue({ items: [] });
    mocks.connections.mockResolvedValue({ people: [] });
    mocks.feed.mockResolvedValue({ items: [], nextCursor: null });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    if (initialCollection === "saved") await selectCollection("saved");
    const press = (label: string) =>
      view!.root
        .findAllByType("Pressable" as React.ElementType)
        .find((button) => button.props.accessibilityLabel === label)!
        .props.onPress();
    await act(async () => {
      press("Add a new Story");
    });
    await act(async () => {
      press("Create text Story");
    });
    await act(async () => {
      view!.root
        .findByType("TextInput" as React.ElementType)
        .props.onChangeText("My private draft");
    });
    await act(async () => {
      press("Choose Story audience");
    });
    await act(async () => {
      view!.root
        .findAllByType("NavigationListRow" as React.ElementType)
        .find((row) => row.props.label === "All friends")!
        .props.onPress();
    });
    return press;
  };

  const pickedPhoto = {
    canceled: false,
    assets: [{ uri: "file:///synthetic-story.jpg", mimeType: "image/jpeg", fileSize: 32 }],
  };

  it.each([
    ["android", "photo", "images"],
    ["android", "video", "videos"],
    ["ios", "photo", "images"],
  ])(
    "opens the scoped %s %s picker without broad library access",
    async (platform, kind, mediaType) => {
      mocks.platform.OS = platform;
      mocks.permission.mockResolvedValue({ granted: false, canAskAgain: false });
      mocks.pickMedia.mockResolvedValue(
        kind === "video"
          ? {
              canceled: false,
              assets: [{ uri: "file:///synthetic-story.mp4", mimeType: "video/mp4", fileSize: 32 }],
            }
          : pickedPhoto,
      );
      const press = await compose();
      await act(async () => {
        press(`Choose Story ${kind}`);
      });
      expect(mocks.permission).not.toHaveBeenCalled();
      expect(mocks.pickMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaTypes: [mediaType],
          exif: false,
        }),
      );
      expect(view!.root.findByProps({ accessibilityLabel: "Change Story media" })).toBeTruthy();
      expect(mocks.initiateMedia).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    "keeps the iOS video permission boundary and recovers after denial (can ask: %s)",
    async (canAskAgain) => {
      mocks.platform.OS = "ios";
      mocks.permission.mockResolvedValue({ granted: false, canAskAgain });
      const press = await compose();
      await act(async () => {
        press("Choose Story video");
      });
      expect(mocks.pickMedia).not.toHaveBeenCalled();
      expect(JSON.stringify(view!.toJSON())).toContain(
        canAskAgain
          ? "Allow photo library access to choose a video."
          : "Allow photo library access in Settings to choose a video.",
      );
      expect(view!.root.findByType("TextInput" as React.ElementType).props.value).toBe(
        "My private draft",
      );
      mocks.permission.mockResolvedValue({ granted: true, canAskAgain: true });
      await act(async () => {
        press("Choose Story video");
      });
      expect(mocks.pickMedia).toHaveBeenCalledTimes(1);
      expect(mocks.initiateMedia).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it("does not launch a picker after a permission response outlives its account screen", async () => {
    mocks.platform.OS = "ios";
    let allow!: () => void;
    mocks.permission.mockReturnValueOnce(
      new Promise((resolve) => {
        allow = () => resolve({ granted: true, canAskAgain: true });
      }),
    );
    const press = await compose();
    await act(async () => {
      press("Choose Story video");
    });
    await act(async () => {
      view!.unmount();
    });
    await act(async () => {
      allow();
    });
    expect(mocks.pickMedia).not.toHaveBeenCalled();
  });

  it("accepts the picker result after normal background/resume and ignores repeated taps", async () => {
    let select!: () => void;
    mocks.pickMedia.mockReturnValueOnce(
      new Promise((resolve) => {
        select = () => resolve(pickedPhoto);
      }),
    );
    const press = await compose();
    await act(async () => {
      press("Choose Story photo");
      press("Choose Story photo");
    });
    expect(mocks.pickMedia).toHaveBeenCalledTimes(1);
    await act(async () => {
      state("background");
    });
    await act(async () => {
      state("active");
    });
    await act(async () => {
      select();
    });
    expect(view!.root.findByProps({ accessibilityLabel: "Change Story media" })).toBeTruthy();
    expect(JSON.stringify(view!.toJSON())).toContain("My private draft");
  });

  it("retains the selected media and caption when its replacement picker is canceled", async () => {
    mocks.pickMedia.mockResolvedValueOnce(pickedPhoto);
    const press = await compose();
    await act(async () => {
      press("Choose Story photo");
    });
    await act(async () => {
      press("Change Story media");
    });
    expect(view!.root.findByType("Image" as React.ElementType).props.source).toBe(
      pickedPhoto.assets[0].uri,
    );
    expect(JSON.stringify(view!.toJSON())).toContain("My private draft");
    expect(mocks.initiateMedia).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recovers from a failed gallery launch without losing the draft", async () => {
    mocks.pickMedia.mockRejectedValueOnce(new Error("Gallery unavailable"));
    const press = await compose();
    await act(async () => {
      press("Choose Story photo");
    });
    expect(JSON.stringify(view!.toJSON())).toContain("Couldn’t open your gallery. Try again.");
    mocks.pickMedia.mockResolvedValueOnce(pickedPhoto);
    await act(async () => {
      press("Choose Story photo");
    });
    expect(JSON.stringify(view!.toJSON())).toContain("My private draft");
    expect(JSON.stringify(view!.toJSON())).not.toContain("Couldn’t open your gallery");
  });

  it("does not attach an old account's delayed picker result to the next account", async () => {
    let select!: () => void;
    mocks.pickMedia.mockReturnValueOnce(
      new Promise((resolve) => {
        select = () => resolve(pickedPhoto);
      }),
    );
    const press = await compose();
    await act(async () => {
      press("Choose Story photo");
    });
    await act(async () => {
      view!.unmount();
    });
    mocks.account = { id: "account-b", status: "ACTIVE" };
    mocks.params = { compose: "1", mode: "story" };
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await act(async () => {
      select();
    });
    expect(view!.root.findAllByProps({ accessibilityLabel: "Change Story media" })).toHaveLength(0);
    expect(JSON.stringify(view!.toJSON())).not.toContain("synthetic-story.jpg");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("retains media after an offline upload and rechecks the audience before retrying", async () => {
    mocks.pickMedia.mockResolvedValueOnce(pickedPhoto);
    mocks.upload.mockRejectedValueOnce(new Error("Upload unavailable. Try again."));
    const press = await compose();
    const share = () => view!.root.findByProps({ label: "Share Story" }).props.onPress();
    await act(async () => {
      press("Choose Story photo");
    });
    await act(async () => {
      share();
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(view!.root.findByProps({ accessibilityLabel: "Change Story media" })).toBeTruthy();
    expect(JSON.stringify(view!.toJSON())).toContain("My private draft");
    expect(JSON.stringify(view!.toJSON())).toContain("Upload unavailable. Try again.");
    mocks.preview.mockResolvedValue({ eligibleCount: 0, lifetimeHours: 24 });
    await act(async () => {
      share();
    });
    expect(mocks.initiateMedia).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.preview.mockResolvedValue({ eligibleCount: 1, lifetimeHours: 24 });
    await act(async () => {
      share();
    });
    expect(mocks.initiateMedia).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "My private draft",
        media: expect.objectContaining({ objectKey: "private-upload" }),
      }),
    );
  });

  it("does not publish when a media upload finishes after backgrounding", async () => {
    let upload!: () => void;
    mocks.upload.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        upload = resolve;
      }),
    );
    mocks.pickMedia.mockResolvedValueOnce(pickedPhoto);
    const press = await compose();
    await act(async () => {
      press("Choose Story photo");
    });
    await act(async () => {
      view!.root.findByProps({ label: "Share Story" }).props.onPress();
    });
    await act(async () => {
      state("background");
    });
    await act(async () => {
      state("active");
    });
    await act(async () => {
      upload();
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(JSON.stringify(view!.toJSON())).toContain("My private draft");
  });

  it("keeps audience choices above search results and retains selections when searching", async () => {
    mocks.params = { compose: "1", mode: "story" };
    mocks.connections.mockResolvedValue({
      people: [
        { id: "alice", displayName: "Alice" },
        { id: "bob", displayName: "Bob" },
      ],
      recipientIds: ["alice", "bob"],
    });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Choose Story audience" }).props.onPress();
    });
    const rows = () => view!.root.findAllByType("NavigationListRow" as React.ElementType);
    expect(view!.root.findAllByType("Input" as React.ElementType)).toHaveLength(0);
    await act(async () =>
      rows()
        .find((row) => row.props.label === "Choose people")!
        .props.onPress(),
    );
    expect(
      rows()
        .slice(0, 4)
        .map((row) => row.props.label),
    ).toEqual(["Choose people", "All friends", "Alice", "Bob"]);
    await act(async () => {
      rows()
        .find((row) => row.props.label === "Alice")!
        .props.onPress();
    });
    const search = () => view!.root.findByType("Input" as React.ElementType);
    const focusedSearch = search();
    let ancestor = focusedSearch.parent;
    while (ancestor) {
      expect(ancestor.type).not.toBe("ScrollView");
      ancestor = ancestor.parent;
    }
    await act(async () => search().props.onChangeText("  BOB  "));
    expect(search()).toBe(focusedSearch);
    expect(rows().some((row) => row.props.label === "Alice")).toBe(false);
    expect(rows().find((row) => row.props.label === "Bob")!.props.selected).toBe(false);
    await act(async () => search().props.onChangeText(""));
    expect(search()).toBe(focusedSearch);
    expect(rows().find((row) => row.props.label === "Alice")!.props.selected).toBe(true);
    expect(rows()[0].props.selected).toBe(true);
    expect(rows()[1].props.selected).toBe(false);
  });

  it("only offsets keyboard overlap with the independent Android modal viewport", async () => {
    mocks.params = { compose: "1", mode: "story" };
    let viewportHeight = 756;
    await act(async () => {
      view = create(<PrivateStoriesScreen />, {
        createNodeMock: () => ({
          measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
            callback(0, 24, 360, viewportHeight),
        }),
      });
    });
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Choose Story audience" }).props.onPress();
    });
    const root = view!.root.findAllByType("View" as React.ElementType).find((node) => node.props.onLayout)!;
    const sheet = () => view!.root.findAllByType("KeyboardAvoidingView" as React.ElementType)
      .find((node) => node.props.pointerEvents === "box-none")!;
    expect(sheet().props.enabled).toBe(false);
    // Even disabled, RN's padding behavior overwrites an explicit paddingBottom with zero.
    expect(sheet().props.behavior).toBeUndefined();
    await act(async () => {
      root.props.onLayout();
      mocks.keyboardListeners.get("keyboardDidShow")!({ endCoordinates: { screenY: 480 } });
    });
    expect(sheet().props.style[1].paddingBottom).toBe(300);
    // If Android has already resized the window, do not subtract the keyboard twice.
    await act(async () => {
      viewportHeight = 456;
      root.props.onLayout();
    });
    expect(sheet().props.style[1].paddingBottom).toBe(0);
    await act(async () => {
      mocks.keyboardListeners.get("keyboardDidHide")!({ endCoordinates: { screenY: 780 } });
      viewportHeight = 756;
      root.props.onLayout();
    });
    expect(sheet().props.style[1].paddingBottom).toBe(0);
    await act(async () => {
      view!.root.findByProps({ label: "Done" }).props.onPress();
    });
    expect(mocks.keyboardListeners.size).toBe(0);
  });

  it("defaults to approved friends and shares media without requiring a caption", async () => {
    mocks.params = { compose: "1", mode: "story" };
    mocks.pickMedia.mockResolvedValueOnce(pickedPhoto);
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(mocks.preview).toHaveBeenCalledWith({ audienceRule: "ALL_APPROVED" });
    const share = () => view!.root.findByProps({ label: "Share Story" });
    expect(share().props.disabled).toBe(true);
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Choose Story photo" }).props.onPress();
    });
    expect(share().props.disabled).toBe(false);
    expect(view!.root.findAllByType("TextInput" as React.ElementType)).toHaveLength(0);
    expect(view!.root.findByProps({ accessibilityLabel: "Edit Story text" })).toBeTruthy();
    expect(view!.root.findByProps({ accessibilityLabel: "Change Story media" })).toBeTruthy();
    await act(async () => {
      share().props.onPress();
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "",
        audienceRule: "ALL_APPROVED",
        media: expect.any(Object),
      }),
    );
  });

  it("does not fall back to all friends when selected people is empty", async () => {
    mocks.params = { compose: "1", mode: "story" };
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Choose Story audience" }).props.onPress();
    });
    await act(async () => {
      view!.root
        .findAllByType("NavigationListRow" as React.ElementType)
        .find((row) => row.props.label === "Choose people")!
        .props.onPress();
    });
    expect(view!.root.findByProps({ label: "Done" }).props.disabled).toBe(true);
    expect(view!.root.findByProps({ label: "Share Story" }).props.disabled).toBe(true);
    await act(async () => {
      view!.root.findByProps({ label: "Share Story" }).props.onPress();
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns a pending Story created from Saved to Active for review status", async () => {
    await compose("saved");
    const pending = ownStory("new", "PENDING");
    mocks.create.mockResolvedValueOnce({ story: pending });
    mocks.mine.mockResolvedValueOnce({ items: [pending] });
    await act(async () => {
      view!.root.findByProps({ label: "Share Story" }).props.onPress();
    });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.back).not.toHaveBeenCalled();
    expect(JSON.stringify(view!.toJSON())).toContain("Private new");
    expect(JSON.stringify(view!.toJSON())).toContain("Awaiting review · only you");
    expect(
      view!.root
        .findAllByType("SegmentedControl" as React.ElementType)
        .find((tab) => tab.props.accessibilityLabel === "Story collection")!.props.value,
    ).toBe("mine");
  });

  it("shares directly after a fresh server audience check and prevents duplicate submission", async () => {
    await compose();
    let finish!: (value: { eligibleCount: number; lifetimeHours: number }) => void;
    mocks.preview.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const share = view!.root
      .findAllByType("Button" as React.ElementType)
      .find((button) => button.props.label === "Share Story")!;
    await act(async () => {
      share.props.onPress();
      share.props.onPress();
    });
    expect(mocks.create).not.toHaveBeenCalled();
    await act(async () => {
      finish({ eligibleCount: 2, lifetimeHours: 24 });
    });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({
      text: "My private draft",
      audienceRule: "ALL_APPROVED",
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it("discards a sharing check that finishes after backgrounding", async () => {
    await compose();
    let finish!: (value: { eligibleCount: number; lifetimeHours: number }) => void;
    mocks.preview.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "Share Story")!
        .props.onPress();
    });
    await act(async () => {
      state("background");
      finish({ eligibleCount: 1, lifetimeHours: 24 });
    });
    expect(mocks.create).not.toHaveBeenCalled();
    await act(async () => {
      state("active");
    });
    expect(JSON.stringify(view!.toJSON())).toContain("My private draft");
  });

  it("blocks sharing when eligible connections were revoked", async () => {
    await compose();
    mocks.preview.mockResolvedValueOnce({ eligibleCount: 0, lifetimeHours: 24 });
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "Share Story")!
        .props.onPress();
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(JSON.stringify(view!.toJSON())).toContain(
      "Choose at least one eligible approved connection",
    );
  });

  it("retains the Story draft across Scene mode and blocks accidental dismissal", async () => {
    await compose();
    const tabs = view!.root.findByType("SegmentedControl" as React.ElementType);
    await act(async () => {
      tabs.props.onChange("scene");
    });
    expect(view!.root.findByType("SceneComposerSheet" as React.ElementType).props.visible).toBe(
      true,
    );
    await act(async () => {
      tabs.props.onChange("story");
    });
    expect(view!.root.findByType("TextInput" as React.ElementType).props.value).toBe(
      "My private draft",
    );
    const [enabled, prevent] = mocks.prevent.mock.calls.at(-1)!;
    expect(enabled).toBe(true);
    await act(async () => {
      prevent({ data: { action: { type: "GO_BACK" } } });
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    const discard = vi
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find((button) => button.style === "destructive")!;
    await act(async () => {
      discard.onPress?.();
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
  });

  it("confirms only audience expansion and rejects a stale confirmation", async () => {
    mocks.mine.mockResolvedValue({
      items: [
        {
          id: "own",
          text: "Original",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          moderationStatus: "APPROVED",
        },
      ],
    });
    mocks.detail.mockResolvedValue({
      story: { text: "Original", audienceRule: "SELECTED", communityFilter: null },
      recipientIds: ["person-a"],
    });
    await act(async () => {
      view = create(<PrivateStoriesScreen />);
    });
    await openOptions();
    await act(async () => {
      row("Edit audience").props.onPress();
    });
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Choose Story audience" }).props.onPress();
    });
    await act(async () => {
      view!.root
        .findAllByType("NavigationListRow" as React.ElementType)
        .find((row) => row.props.label === "All friends")!
        .props.onPress();
    });
    mocks.update.mockRejectedValueOnce(new Error("Review and confirm the new audience"));
    await act(async () => {
      view!.root
        .findAllByType("Button" as React.ElementType)
        .find((button) => button.props.label === "Save Story")!
        .props.onPress();
    });
    const confirm = vi
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find((button) => button.text === "Expand audience")!;
    expect(mocks.update).toHaveBeenCalledWith("own", {
      text: "Original",
      audienceRule: "ALL_APPROVED",
    });
    await act(async () => {
      state("background");
      state("active");
    });
    await act(async () => {
      confirm.onPress?.();
    });
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});
