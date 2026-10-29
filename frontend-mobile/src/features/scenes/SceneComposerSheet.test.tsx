import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneDto } from "../../types/scenes";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  picker: vi.fn(),
  initiate: vi.fn(),
  finalize: vi.fn(),
  photo: vi.fn(),
  upload: vi.fn(),
  submit: vi.fn(),
  dirty: vi.fn(),
  busy: vi.fn(),
  size: 2048,
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: mocks.permission,
  requestCameraPermissionsAsync: mocks.permission,
  launchImageLibraryAsync: mocks.picker,
  launchCameraAsync: mocks.picker,
  MediaTypeOptions: { Images: "images" },
}));
vi.mock("expo-file-system", () => ({
  File: class {
    get size() {
      return mocks.size;
    }
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  AppState: { currentState: "active" },
}));
vi.mock("../../api/endpoints/profiles", () => ({
  profilesApi: {
    initiatePhotoUpload: mocks.initiate,
    finalizePhoto: mocks.finalize,
    photo: mocks.photo,
  },
}));
vi.mock("../../api/upload", () => ({ uploadToPresignedUrl: mocks.upload }));
vi.mock("../../components/dating", () => ({ SegmentedControl: "SegmentedControl" }));
vi.mock("../../components/ui/Button", () => ({
  Button: ({ leftIcon, rightIcon, ...props }: import("../../components/ui/Button").ButtonProps) =>
    React.createElement("Button", props, leftIcon, rightIcon),
}));
vi.mock("../../components/ui/Input", () => ({ Input: "Input" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ palette: {} }),
  createThemeStyleHook: () => () => ({}),
}));
vi.mock("../../localization/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

import { SceneComposerSheet } from "./SceneComposerSheet";

describe("Scene composer media and availability", () => {
  let view: ReactTestRenderer;
  const props = {
    visible: true,
    scene: null as SceneDto | null,
    busy: false,
    canPublish: true,
    error: null,
    lifetimeHours: 12,
    onDirtyChange: mocks.dirty,
    onBusyChange: mocks.busy,
    onSubmit: mocks.submit,
  };
  const existing = {
    id: "scene",
    version: 1,
    intent: "DATING",
    activity: "Coffee",
    tags: ["coffee"],
    photo: { id: "original", url: "https://scene.example/original" },
    availableFrom: "2026-10-23T09:00:00Z",
    availableUntil: "2026-10-23T09:45:00Z",
    expiresAt: "2026-10-23T18:00:00Z",
  } as SceneDto;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.size = 2048;
    mocks.permission.mockResolvedValue({ granted: true });
    mocks.picker.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///new.jpg",
          fileName: "new.jpg",
          mimeType: "image/jpeg",
          fileSize: 9999,
          width: 900,
          height: 1600,
        },
      ],
    });
    mocks.initiate.mockResolvedValue({
      uploadUrl: "https://upload.example",
      uploadToken: "scene-token",
      objectKey: "scene-key",
      bucket: "scene-bucket",
      headers: { "x-test": "scene" },
    });
    mocks.upload.mockResolvedValue(undefined);
    mocks.finalize.mockResolvedValue({
      photo: {
        id: "new-scene",
        url: "https://scene.example/new",
        moderationStatus: "APPROVED",
      },
    });
  });
  afterEach(async () => {
    await act(async () => view?.unmount());
  });
  const mount = async (scene: SceneDto | null = null) => {
    await act(async () => {
      view = create(<SceneComposerSheet {...props} scene={scene} />);
    });
  };
  const gallery = async () => {
    await act(async () => {
      await view.root
        .findAllByType("Pressable" as React.ElementType)
        .find((node) => node.props.accessibilityLabel === "scene.photo.gallery")!
        .props.onPress();
    });
  };
  const submit = async () => {
    await act(async () => {
      view.root
        .findAllByType("Button" as React.ElementType)
        .find((node) => node.props.fullWidth)!
        .props.onPress();
    });
  };

  it("uses the Scene upload purpose and actual bytes, selecting only reviewed media", async () => {
    await mount(existing);
    await gallery();
    expect(mocks.initiate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "SCENE", sizeBytes: 2048 }),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadHeaders: { "x-test": "scene" } }),
    );
    expect(mocks.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ uploadToken: "scene-token", sizeBytes: 2048 }),
    );
    await submit();
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        photoId: "new-scene",
        availableFrom: existing.availableFrom,
        availableUntil: existing.availableUntil,
      }),
    );
  });

  it("keeps the previous photo and draft when moderation rejects or selection is cancelled", async () => {
    await mount(existing);
    mocks.finalize.mockResolvedValueOnce({
      photo: { id: "rejected", moderationStatus: "REJECTED" },
    });
    await gallery();
    expect(JSON.stringify(view.toJSON())).toContain("scene.photo.rejected");
    mocks.picker.mockResolvedValueOnce({ canceled: true });
    await gallery();
    await submit();
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({ photoId: "original", activity: "Coffee" }),
    );
    expect(mocks.initiate).toHaveBeenCalledTimes(1);
  });

  it("blocks denied permissions and oversized files before upload and supports retry", async () => {
    await mount(existing);
    mocks.permission.mockResolvedValueOnce({ granted: false });
    await gallery();
    expect(mocks.picker).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain("scene.photo.galleryPermission");
    mocks.size = 11 * 1024 * 1024;
    await gallery();
    expect(mocks.initiate).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain("scene.photo.sizeError");
    mocks.size = 2048;
    await gallery();
    expect(mocks.initiate).toHaveBeenCalledOnce();
  });

  it("preserves the exact availability during unrelated edits and retains a hidden draft", async () => {
    await mount(existing);
    await act(async () => {
      view.root.findByType("Input" as React.ElementType).props.onChangeText("Coffee and a walk");
    });
    await act(async () => {
      view.update(<SceneComposerSheet {...props} scene={existing} visible={false} />);
    });
    await act(async () => {
      view.update(<SceneComposerSheet {...props} scene={existing} />);
    });
    await submit();
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: "Coffee and a walk",
        availableFrom: existing.availableFrom,
        availableUntil: existing.availableUntil,
      }),
    );
  });
});
