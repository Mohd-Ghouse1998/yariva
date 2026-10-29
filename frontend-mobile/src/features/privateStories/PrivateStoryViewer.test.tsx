import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Story } from "../../api/endpoints/privateStories";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  push: vi.fn(),
  setSaved: vi.fn(),
  remove: vi.fn(),
  state: undefined as ((state: string) => void) | undefined,
  videoStatus: undefined as ((event: { status: string }) => void) | undefined,
  videoEnd: undefined as (() => void) | undefined,
  videoTime: undefined as ((event: { currentTime: number }) => void) | undefined,
  screenReaderChanged: undefined as ((enabled: boolean) => void) | undefined,
  screenReader: vi.fn().mockResolvedValue(false),
  player: {
    status: "readyToPlay",
    duration: 5,
    play: vi.fn(),
    pause: vi.fn(),
    addListener: vi.fn(),
  },
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-video", () => ({ useVideoPlayer: () => mocks.player, VideoView: "VideoView" }));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  ActivityIndicator: "ActivityIndicator",
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  View: "View",
  StyleSheet: { create: (value: object) => value, absoluteFill: {} },
  AccessibilityInfo: {
    isScreenReaderEnabled: mocks.screenReader,
    addEventListener: (_: string, callback: (enabled: boolean) => void) => {
      mocks.screenReaderChanged = callback;
      return {
        remove: () => {
          mocks.screenReaderChanged = undefined;
        },
      };
    },
  },
  PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) },
  AppState: {
    currentState: "active",
    addEventListener: (_: string, callback: (state: string) => void) => {
      mocks.state = callback;
      return {
        remove: () => {
          mocks.state = undefined;
        },
      };
    },
  },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../../api/endpoints/privateStories", () => ({
  privateStoriesApi: { detail: mocks.detail, setSaved: mocks.setSaved, remove: mocks.remove },
}));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../theme/ThemeContext", () => ({ useTheme: () => ({ palette: {} }) }));

vi.mock("../../localization/LocalizationContext", async () => {
  const { translate } = await import("../../localization/translate");
  return { useLocalization: () => ({ t: (key: string) => translate("en", "standard", key) }) };
});
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/NavigationList", () => ({ NavigationListRow: "NavigationListRow" }));

import { PrivateStoryViewer } from "./PrivateStoryViewer";

const story: Story = {
  id: "story",
  ownerId: "owner",
  ownerName: "Connection",
  text: "Private caption",
  mediaMimeType: null,
  moderationStatus: "APPROVED",
  audienceRule: "SELECTED",
  communityFilter: null,
  createdAt: "2026-10-19T00:00:00Z",
  expiresAt: "2026-10-20T00:00:00Z",
};
const contents = (view: ReactTestRenderer) => JSON.stringify(view.toJSON());

describe("private Story viewer access lifecycle", () => {
  let view: ReactTestRenderer | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    mocks.detail.mockReset();
    mocks.screenReader.mockReset();
    mocks.screenReader.mockResolvedValue(false);
    mocks.player.addListener.mockImplementation((event: string, callback: never) => {
      if (event === "statusChange") mocks.videoStatus = callback;
      if (event === "playToEnd") mocks.videoEnd = callback;
      if (event === "timeUpdate") mocks.videoTime = callback;
      return { remove: vi.fn() };
    });
  });
  afterEach(async () => {
    await act(async () => view?.unmount());
    vi.useRealTimers();
  });

  it("opens an expired owner archive and removes it without offering audience edits", async () => {
    const archived = { ...story, savedAt: story.createdAt, expiresAt: "2026-10-19T01:00:00Z" };
    const onClose = vi.fn(),
      onOwnerChange = vi.fn();
    mocks.detail.mockResolvedValueOnce({ story: archived, recipientIds: [] });
    mocks.setSaved.mockResolvedValueOnce({ story: { ...archived, savedAt: null } });
    await act(async () => {
      view = create(
        <PrivateStoryViewer
          storyId="story"
          onClose={onClose}
          onOwnerChange={onOwnerChange}
          onEdit={vi.fn()}
        />,
      );
    });
    expect(contents(view!)).toContain("Saved privately");
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Story options" }).props.onPress();
    });
    const rows = view!.root.findAllByType("NavigationListRow" as React.ElementType);
    expect(rows.map((row) => row.props.label)).toEqual(["Remove from saved", "Delete Story"]);
    await act(async () => {
      rows[0].props.onPress();
    });
    expect(mocks.setSaved).toHaveBeenCalledWith("story", false);
    expect(onOwnerChange).toHaveBeenCalledWith("story", expect.objectContaining({ savedAt: null }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("never treats a recipient's stale saved flag as owner permission", async () => {
    mocks.detail.mockResolvedValueOnce({
      story: { ...story, savedAt: story.createdAt, expiresAt: "2026-10-19T01:00:00Z" },
    });
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
    });
    expect(contents(view!)).not.toContain(story.text);
    expect(contents(view!)).toContain("This Story has expired.");
  });

  it("removes audience editing when a saved Story expires with its menu open", async () => {
    mocks.detail.mockResolvedValueOnce({
      story: {
        ...story,
        savedAt: story.createdAt,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
      recipientIds: [],
    });
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} onEdit={vi.fn()} />);
    });
    await act(async () => {
      view!.root.findByProps({ accessibilityLabel: "Story options" }).props.onPress();
    });
    expect(contents(view!)).toContain("Edit audience");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    expect(contents(view!)).not.toContain("Edit audience");
    expect(contents(view!)).toContain("Remove from saved");
  });

  it("clears content on background, ignores stale reads, and denies revoked access on resume", async () => {
    mocks.detail.mockResolvedValueOnce({ story });
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} canReport />);
    });
    expect(contents(view!)).toContain(story.text);
    await act(async () => {
      mocks.state?.("background");
    });
    expect(contents(view!)).not.toContain(story.text);
    let finish!: (value: { story: Story }) => void;
    mocks.detail.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      mocks.state?.("active");
    });
    await act(async () => {
      mocks.state?.("inactive");
      finish({ story });
    });
    expect(contents(view!)).not.toContain(story.text);
    mocks.detail.mockRejectedValueOnce(new Error("Not found"));
    await act(async () => {
      mocks.state?.("active");
    });
    expect(contents(view!)).toContain("unavailable or has expired");
    expect(contents(view!)).not.toContain(story.ownerName);
    expect(
      view!.root.findAll((node) => node.props.accessibilityLabel === "Report this Story"),
    ).toHaveLength(0);
  });

  it("removes an open Story when its server expiry arrives", async () => {
    mocks.detail.mockResolvedValueOnce({
      story: { ...story, expiresAt: new Date(Date.now() + 1500).toISOString() },
    });
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
    });
    expect(contents(view!)).toContain(story.text);
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(contents(view!)).not.toContain(story.text);
    expect(contents(view!)).toContain("This Story has expired.");
  });

  it.each(["image/png", "video/mp4"])(
    "clears failed %s content and offers a fresh authorized read",
    async (mediaMimeType) => {
      mocks.detail.mockResolvedValueOnce({
        story: { ...story, mediaMimeType, mediaUrl: "https://private.invalid/signed" },
      });
      await act(async () => {
        view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
      });
      await act(async () => {
        if (mediaMimeType.startsWith("video")) mocks.videoStatus?.({ status: "error" });
        else view!.root.findByType("Image" as React.ElementType).props.onError();
      });
      expect(contents(view!)).toContain(
        `Couldn’t load this ${mediaMimeType.startsWith("video") ? "video" : "photo"}`,
      );
      expect(contents(view!)).not.toContain("private.invalid");
      mocks.detail.mockRejectedValueOnce(new Error("Deleted"));
      await act(async () => {
        view!.root
          .find((node) => node.props.accessibilityLabel === "Retry loading Story")
          .props.onPress();
      });
      expect(mocks.detail).toHaveBeenCalledTimes(2);
      expect(contents(view!)).toContain("unavailable or has expired");
    },
  );

  it.each([
    ["image/png", "navigation"],
    ["video/mp4", "navigation"],
    ["image/png", "resume"],
    ["video/mp4", "resume"],
  ])(
    "ignores delayed %s errors after a new authorized read on %s",
    async (mediaMimeType, transition) => {
      mocks.detail.mockResolvedValueOnce({
        story: { ...story, mediaMimeType, mediaUrl: "https://private.invalid/old" },
      });
      await act(async () => {
        view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
      });
      const oldVideoStatus = mocks.videoStatus;
      const failOldMedia = mediaMimeType.startsWith("video")
        ? () => oldVideoStatus!({ status: "error" })
        : view!.root.findByType("Image" as React.ElementType).props.onError;
      const nextStory = {
        ...story,
        id: transition === "navigation" ? "next-story" : story.id,
        text: "Fresh authorized content",
        mediaMimeType,
        mediaUrl: "https://private.invalid/new",
      };
      mocks.detail.mockResolvedValueOnce({ story: nextStory });
      if (transition === "navigation") {
        await act(async () => {
          view!.update(<PrivateStoryViewer storyId={nextStory.id} onClose={vi.fn()} />);
        });
      } else {
        await act(async () => {
          mocks.state?.("background");
        });
        expect(contents(view!)).not.toContain("private.invalid");
        await act(async () => {
          mocks.state?.("active");
        });
      }
      expect(contents(view!)).toContain(nextStory.text);
      await act(async () => {
        failOldMedia();
      });
      expect(contents(view!)).toContain(nextStory.text);
      expect(
        view!.root.findAllByType(
          (mediaMimeType.startsWith("video") ? "VideoView" : "Image") as React.ElementType,
        ),
      ).toHaveLength(1);
      expect(contents(view!)).not.toContain("Couldn’t load this");
    },
  );

  it.each(["image/png", "video/mp4"])(
    "keeps a long %s caption scrollable outside the media controls",
    async (mediaMimeType) => {
      const text = "Private caption. ".repeat(120);
      mocks.detail.mockResolvedValueOnce({
        story: { ...story, text, mediaMimeType, mediaUrl: "https://private.invalid/signed" },
      });
      await act(async () => {
        view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
      });
      const caption = view!.root.findByType("ScrollView" as React.ElementType);
      expect(caption.findByType("Text" as React.ElementType).props.children).toBe(text);
      expect(caption.findAllByType("VideoView" as React.ElementType)).toHaveLength(0);
      expect(caption.findAllByType("Image" as React.ElementType)).toHaveLength(0);
      const media = view!.root.findByType(
        (mediaMimeType.startsWith("video") ? "VideoView" : "Image") as React.ElementType,
      );
      expect(media.parent).not.toBe(caption.parent);
      expect(
        view!.root.findAll((node) => node.props.accessibilityLabel === "Close Story"),
      ).toHaveLength(1);
    },
  );

  it("allows the full text-only Story to scroll without hiding the close action", async () => {
    const text = "Private words. ".repeat(130);
    mocks.detail.mockResolvedValueOnce({ story: { ...story, text } });
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
    });
    const caption = view!.root.findByType("ScrollView" as React.ElementType);
    expect(caption.findByType("Text" as React.ElementType).props.children).toBe(text);
    expect(caption.findAll((node) => node.props.accessibilityLabel === "Close Story")).toHaveLength(
      0,
    );
  });

  it("waits for photo readiness, pauses for controls and holds, then authorizes the next Story", async () => {
    const onClose = vi.fn();
    mocks.detail.mockResolvedValueOnce({
      story: { ...story, mediaMimeType: "image/png", mediaUrl: "https://private.invalid/signed" },
    });
    mocks.detail.mockRejectedValueOnce(new Error("Access revoked"));
    const Queue = () => {
      const [id, setId] = React.useState("story");
      return (
        <PrivateStoryViewer
          storyId={id}
          storyIds={["story", "next"]}
          onStoryChange={setId}
          onClose={onClose}
        />
      );
    };
    await act(async () => {
      view = create(<Queue />);
    });
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    await act(async () => {
      view!.root.findByType("Image" as React.ElementType).props.onLoad();
    });
    const find = (label: string) =>
      view!.root.find((node) => node.props.accessibilityLabel === label);
    await act(async () => {
      find("Story options").props.onPress();
    });
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    await act(async () => {
      find("Story options").props.onPress();
      find("Pause Story").props.onPress();
    });
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    await act(async () => {
      find("Resume Story").props.onPress();
    });
    await act(async () => {
      find("Next Story").props.onPressIn();
      find("Next Story").props.onLongPress();
    });
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    await act(async () => {
      find("Next Story").props.onPressOut();
      find("Next Story").props.onPress();
    });
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(mocks.detail).toHaveBeenLastCalledWith("next");
    expect(contents(view!)).not.toContain(story.text);
    expect(contents(view!)).toContain("unavailable or has expired");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses video progress and completion, with pause and buffering support", async () => {
    const onChange = vi.fn();
    mocks.detail.mockResolvedValueOnce({
      story: { ...story, mediaMimeType: "video/mp4", mediaUrl: "https://private.invalid/signed" },
    });
    await act(async () => {
      view = create(
        <PrivateStoryViewer
          storyId="story"
          storyIds={["story", "next"]}
          onStoryChange={onChange}
          onClose={vi.fn()}
        />,
      );
    });
    expect(mocks.player.play).toHaveBeenCalled();
    await act(async () => {
      mocks.videoTime?.({ currentTime: 2.5 });
    });
    expect(
      view!.root.find((node) => node.props.accessibilityRole === "progressbar").props
        .accessibilityValue.now,
    ).toBe(50);
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Pause Story").props.onPress();
    });
    expect(mocks.player.pause).toHaveBeenCalled();
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Resume Story").props.onPress();
    });
    mocks.player.pause.mockClear();
    await act(async () => {
      mocks.videoStatus?.({ status: "loading" });
    });
    expect(mocks.player.pause).toHaveBeenCalled();
    await act(async () => {
      mocks.videoStatus?.({ status: "readyToPlay" });
    });
    await act(async () => {
      mocks.videoEnd?.();
    });
    expect(onChange).toHaveBeenCalledWith("next");
    expect(view!.root.findByType("VideoView" as React.ElementType).props.nativeControls).toBe(
      false,
    );
  });

  it("keeps screen-reader playback paused until explicitly resumed", async () => {
    mocks.screenReader.mockResolvedValue(true);
    mocks.detail.mockResolvedValueOnce({ story });
    const onClose = vi.fn();
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={onClose} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Resume Story").props.onPress();
    });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(["pause", "options", "hold", "caption"])(
    "defers a queued video completion during %s until playback resumes",
    async (interaction) => {
      mocks.detail.mockResolvedValueOnce({
        story: { ...story, mediaMimeType: "video/mp4", mediaUrl: "https://private.invalid/signed" },
      });
      mocks.detail.mockRejectedValueOnce(new Error("Access revoked"));
      const onClose = vi.fn();
      const Queue = () => {
        const [id, setId] = React.useState("story");
        return (
          <PrivateStoryViewer
            storyId={id}
            storyIds={["story", "next"]}
            onStoryChange={setId}
            onClose={onClose}
          />
        );
      };
      await act(async () => {
        view = create(<Queue />);
      });
      const find = (label: string) =>
        view!.root.find((node) => node.props.accessibilityLabel === label);
      const oldEnd = mocks.videoEnd!;
      await act(async () => {
        if (interaction === "pause") find("Pause Story").props.onPress();
        if (interaction === "options") find("Story options").props.onPress();
        if (interaction === "hold") {
          find("Next Story").props.onPressIn();
          find("Next Story").props.onLongPress();
        }
        if (interaction === "caption")
          view!.root.findByType("ScrollView" as React.ElementType).props.onTouchStart();
      });
      await act(async () => {
        oldEnd();
        mocks.videoStatus?.({ status: "idle" });
      });
      expect(mocks.detail).toHaveBeenCalledTimes(1);
      expect(contents(view!)).toContain(story.text);
      expect(contents(view!)).not.toContain("Loading Story");
      await act(async () => {
        if (interaction === "pause") find("Resume Story").props.onPress();
        if (interaction === "options") find("Story options").props.onPress();
        if (interaction === "hold") {
          find("Next Story").props.onPressOut();
          find("Next Story").props.onPress();
        }
        if (interaction === "caption")
          view!.root.findByType("ScrollView" as React.ElementType).props.onTouchEnd();
      });
      expect(mocks.detail).toHaveBeenLastCalledWith("next");
      expect(contents(view!)).toContain("unavailable or has expired");
      expect(contents(view!)).not.toContain(story.text);
      await act(async () => {
        oldEnd();
      });
      expect(mocks.detail).toHaveBeenCalledTimes(2);
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it.each(["before", "after"])(
    "finishes a video when native status changes to idle %s its completion event",
    async (order) => {
      mocks.detail.mockResolvedValueOnce({
        story: { ...story, mediaMimeType: "video/mp4", mediaUrl: "https://private.invalid/signed" },
      });
      const onClose = vi.fn();
      await act(async () => {
        view = create(<PrivateStoryViewer storyId="story" onClose={onClose} />);
      });
      await act(async () => {
        if (order === "before") mocks.videoStatus?.({ status: "idle" });
        mocks.videoEnd?.();
        if (order === "after") mocks.videoStatus?.({ status: "idle" });
      });
      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  it("ignores late completion after a video fails and preserves the retry action", async () => {
    mocks.detail.mockResolvedValueOnce({
      story: { ...story, mediaMimeType: "video/mp4", mediaUrl: "https://private.invalid/signed" },
    });
    const onChange = vi.fn();
    await act(async () => {
      view = create(
        <PrivateStoryViewer
          storyId="story"
          storyIds={["story", "next"]}
          onStoryChange={onChange}
          onClose={vi.fn()}
        />,
      );
    });
    const oldEnd = mocks.videoEnd!;
    await act(async () => {
      mocks.videoStatus?.({ status: "error" });
    });
    await act(async () => {
      oldEnd();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(contents(view!)).toContain("Couldn’t load this video");
    expect(
      view!.root.findAll((node) => node.props.accessibilityLabel === "Retry loading Story"),
    ).toHaveLength(1);
  });

  it.each([null, "video/mp4"])(
    "waits for delayed screen-reader detection before starting %s playback",
    async (mediaMimeType) => {
      let resolve!: (enabled: boolean) => void;
      mocks.screenReader.mockReturnValueOnce(
        new Promise<boolean>((done) => {
          resolve = done;
        }),
      );
      mocks.detail.mockResolvedValueOnce({
        story: {
          ...story,
          mediaMimeType,
          mediaUrl: mediaMimeType ? "https://private.invalid/signed" : undefined,
        },
      });
      const onClose = vi.fn();
      await act(async () => {
        view = create(<PrivateStoryViewer storyId="story" onClose={onClose} />);
      });
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(mocks.player.play).not.toHaveBeenCalled();
      expect(
        view!.root.find((node) => node.props.accessibilityRole === "progressbar").props
          .accessibilityValue.now,
      ).toBe(0);
      await act(async () => {
        resolve(true);
      });
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => {
        view!.root.find((node) => node.props.accessibilityLabel === "Resume Story").props.onPress();
      });
      await act(async () => {
        if (mediaMimeType) mocks.videoEnd?.();
        else vi.advanceTimersByTime(8000);
      });
      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  it("does not let an older screen-reader query overwrite a newer accessibility event", async () => {
    let resolve!: (enabled: boolean) => void;
    mocks.screenReader.mockReturnValueOnce(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    mocks.detail
      .mockResolvedValueOnce({ story })
      .mockResolvedValueOnce({ story: { ...story, id: "next" } });
    const onClose = vi.fn();
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={onClose} />);
    });
    await act(async () => {
      mocks.screenReaderChanged?.(true);
    });
    await act(async () => {
      resolve(false);
    });
    await act(async () => {
      view!.update(<PrivateStoryViewer storyId="next" onClose={onClose} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      view!.root.findAll((node) => node.props.accessibilityLabel === "Resume Story"),
    ).toHaveLength(1);
  });

  it("keeps playback manually resumable if screen-reader detection fails", async () => {
    mocks.screenReader.mockRejectedValueOnce(new Error("Native accessibility unavailable"));
    mocks.detail.mockResolvedValueOnce({ story });
    const onClose = vi.fn();
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={onClose} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Resume Story").props.onPress();
    });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preserves a manual pause when delayed detection reports no screen reader", async () => {
    let resolve!: (enabled: boolean) => void;
    mocks.screenReader.mockReturnValueOnce(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    mocks.detail.mockResolvedValueOnce({ story });
    const onClose = vi.fn();
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={onClose} />);
    });
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Pause Story").props.onPress();
    });
    await act(async () => {
      resolve(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Resume Story").props.onPress();
    });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(["PENDING", "REJECTED"] as const)(
    "does not describe a %s Story as shared in its privacy options",
    async (moderationStatus) => {
      mocks.detail.mockResolvedValueOnce({ story: { ...story, moderationStatus } });
      await act(async () => {
        view = create(<PrivateStoryViewer storyId="story" onClose={vi.fn()} />);
      });
      await act(async () => {
        view!.root
          .find((node) => node.props.accessibilityLabel === "Story options")
          .props.onPress();
      });
      expect(contents(view!)).toContain("only you can see this");
      expect(contents(view!)).not.toContain("Shared with selected approved connections");
    },
  );

  it("keeps reporting in options and dismisses by a downward swipe", async () => {
    mocks.detail.mockResolvedValueOnce({ story });
    const onClose = vi.fn();
    await act(async () => {
      view = create(<PrivateStoryViewer storyId="story" onClose={onClose} canReport />);
    });
    expect(
      view!.root.findAll((node) => node.props.accessibilityLabel === "Report this Story"),
    ).toHaveLength(0);
    await act(async () => {
      view!.root.find((node) => node.props.accessibilityLabel === "Story options").props.onPress();
    });
    await act(async () => {
      view!.root
        .find((node) => node.props.accessibilityLabel === "Report this Story")
        .props.onPress();
    });
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/(app)/report",
      params: { targetType: "PRIVATE_STORY", targetId: story.id, reportedUserId: story.ownerId },
    });
    const navigation = view!.root.find((node) => !!node.props.onPanResponderRelease);
    expect(navigation.props.onMoveShouldSetPanResponder(null, { dx: 5, dy: 40 })).toBe(true);
    await act(async () => {
      navigation.props.onPanResponderRelease(null, { dy: 90 });
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
