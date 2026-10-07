import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProfileDto } from "../../types/profile";

const dimensions = vi.hoisted(() => ({ width: 360, height: 780, fontScale: 1, scale: 3 }));
vi.mock("react-native", () => ({
  Pressable: ({ children, style, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(
      "Pressable",
      {
        ...props,
        style:
          typeof style === "function"
            ? style({ pressed: false, hovered: false, focused: false })
            : style,
      },
      children,
    ),
  View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("View", props, children),
  useWindowDimensions: () => dimensions,
}));

vi.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) => React.createElement("Image", props),
}));

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("LinearGradient", props, props.children),
}));

vi.mock("@react-native-masked-view/masked-view", () => ({
  default: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("MaskedView", props, props.children),
}));

vi.mock("react-native-svg", () => ({
  default: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("Svg", props, props.children),
  Path: (props: Record<string, unknown>) => React.createElement("Path", props),
}));

const palette = new Proxy(
  {},
  { get: (_target, property) => `color-${String(property)}` },
) as Record<string, string>;

vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ palette }),
  createThemeStyleHook:
    (factory: (colors: Record<string, string>) => Record<string, unknown>) => () =>
      factory(palette),
}));

vi.mock("../ui/Icon", () => ({
  Icon: (props: Record<string, unknown>) => React.createElement("Icon", props),
}));

vi.mock("../ui/PetalBackdrop", () => ({
  PetalBackdrop: (props: Record<string, unknown>) => React.createElement("PetalBackdrop", props),
}));

vi.mock("../ui/Text", () => ({
  Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("Text", props, children),
}));

vi.mock("./VerificationBadge", () => ({
  VerificationBadge: (props: Record<string, unknown>) =>
    React.createElement("VerificationBadge", props),
}));

const follow = vi.hoisted(() => ({
  change: vi.fn(),
  status: "NONE" as "NONE" | "PENDING" | "APPROVED",
}));
vi.mock("../../features/privateStories/usePrivateFollow", () => ({
  usePrivateFollow: () => ({
    status: follow.status,
    busy: false,
    label:
      follow.status === "PENDING"
        ? "Requested"
        : follow.status === "APPROVED"
          ? "Following"
          : "Follow",
    change: follow.change,
  }),
}));

import { ProfilePreviewCard } from "./ProfilePreviewCard";

const profile = {
  userId: "user-sana",
  displayName: "Sana",
  headline: "Community kitchens, poetry, sunrise walks",
  bio: null,
  age: 30,
  gender: "WOMAN",
  pronouns: "she/her",
  verificationStatus: "VERIFIED",
  preferredRelationshipPace: null,
  languages: [],
  foodPreferences: [],
  profilePrompts: [],
  compatibility: { score: 88, reasons: [], sharedInterests: [], scheduleOverlap: null },
  sensitiveCompatibility: null,
  location: {
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    distanceKmRounded: 3,
    distanceBand: "LOCAL",
  },
  intents: ["DATING"],
  interests: [],
  lifestyle: {
    smoking: null,
    drinking: null,
    exercise: null,
    diet: null,
    petPreference: null,
    sleepPattern: null,
    socialEnergy: null,
  },
  photos: [
    {
      id: "secondary-photo",
      url: "https://example.com/secondary.jpg",
      width: 800,
      height: 1066,
      isPrimary: false,
      position: 1,
    },
    {
      id: "primary-photo",
      url: "https://example.com/primary.jpg",
      width: 800,
      height: 1066,
      isPrimary: true,
      position: 0,
    },
  ],
} as PublicProfileDto;

const renderCard = async (availableHeight?: number) => {
  const onOpen = vi.fn();
  const onInterested = vi.fn();
  const onNotForMe = vi.fn();
  let renderer: ReactTestRenderer | undefined;

  await act(async () => {
    renderer = create(
      <ProfilePreviewCard
        profile={profile}
        position={1}
        total={2}
        availableHeight={availableHeight}
        onOpen={onOpen}
        onInterested={onInterested}
        onNotForMe={onNotForMe}
      />,
    );
  });

  if (!renderer) throw new Error("Profile preview did not render");
  return { renderer, onOpen, onInterested, onNotForMe };
};

describe("ProfilePreviewCard", () => {
  beforeEach(() => {
    dimensions.fontScale = 1;
    follow.status = "NONE";
    follow.change.mockClear();
  });
  it("shows a direct follow action without changing Like or profile navigation", async () => {
    const { renderer, onOpen, onInterested } = await renderCard();
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "Request to follow Sana" }).props.onPress();
      renderer.root.findByProps({ accessibilityLabel: "View Sana's full profile" }).props.onPress();
      renderer.root.findByProps({ accessibilityLabel: "Like Sana" }).props.onPress();
    });
    expect(follow.change).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(profile);
    expect(onInterested).toHaveBeenCalledWith(profile);
  });
  it("aligns Follow with the name and gives it a neutral social treatment", async () => {
    const { renderer } = await renderCard();
    const followButton = renderer.root.findByProps({
      accessibilityLabel: "Request to follow Sana",
    });
    const nameLink = renderer.root.findByProps({
      accessibilityLabel: "Open Sana's full profile, 1 of 2",
    });
    expect(followButton.parent).toBe(nameLink.parent);
    expect(followButton.props.hitSlop).toEqual({ top: 6, bottom: 6 });
    expect(followButton.props.style({ pressed: false })[1]).toMatchObject({
      backgroundColor: "color-followStart",
      borderColor: "color-socialAccent",
    });
    expect(followButton.findAllByType("LinearGradient" as React.ElementType)).toHaveLength(0);
  });
  it("uses a sand treatment when a follow request is pending", async () => {
    follow.status = "PENDING";
    const { renderer } = await renderCard();
    const button = renderer.root.findByProps({
      accessibilityLabel: "Follow requested for Sana. Tap to cancel",
    });
    expect(button.props.style({ pressed: false })[1].backgroundColor).toBe("color-surfaceSubdued");
    expect(button.findByType("Text" as React.ElementType).props.children).toBe("Requested");
  });
  it("fills the measured page with centered, accessible decisions at large text", async () => {
    dimensions.fontScale = 1.3;
    const { renderer } = await renderCard(640);
    const views = renderer.root.findAll((node) => node.type === ("View" as React.ElementType));
    expect(
      views.some(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.some((style: { height?: number }) => style?.height === 640),
      ),
    ).toBe(true);
    for (const label of ["Like Sana", "Skip Sana"]) {
      const target = renderer.root.findByProps({ accessibilityLabel: label });
      const style =
        typeof target.props.style === "function"
          ? target.props.style({ pressed: false })
          : target.props.style;
      expect(style[0]).toMatchObject({ width: 56, height: 56 });
    }
    const headline = renderer.root
      .findAllByType("Text" as React.ElementType)
      .find((node) => node.props.children === profile.headline);
    expect(headline?.props.numberOfLines).toBe(1);
  });
  it("uses a short-page summary without shrinking text or hiding full-profile access", async () => {
    dimensions.fontScale = 1.3;
    const { renderer, onOpen } = await renderCard(220);
    expect(renderer.root.findAllByProps({ numberOfLines: 2 })).toHaveLength(0);
    renderer.root
      .findByProps({ accessibilityLabel: "Open Sana's full profile, 1 of 2" })
      .props.onPress();
    expect(onOpen).toHaveBeenCalledWith(profile);
    expect(renderer.root.findByProps({ accessibilityLabel: "Like Sana" })).toBeTruthy();
  });
  it("uses edge taps to move through every approved profile photo", async () => {
    const { renderer } = await renderCard();

    expect(renderer.root.findByProps({ accessibilityLabel: "Photo 1 of 2" })).toBeTruthy();
    expect(renderer.root.findByProps({ contentFit: "cover" }).props.source).toBe(
      "https://example.com/primary.jpg",
    );

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "Next photo of Sana" }).props.onPress();
    });

    expect(renderer.root.findByProps({ contentFit: "cover" }).props.source).toBe(
      "https://example.com/secondary.jpg",
    );
    expect(renderer.root.findByProps({ accessibilityLabel: "Photo 2 of 2" })).toBeTruthy();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Next photo of Sana" }).props
        .accessibilityState,
    ).toEqual({ disabled: true });
  });

  it("keeps one Like flow, a separate Skip action, and identity navigation", async () => {
    const { renderer, onOpen, onInterested, onNotForMe } = await renderCard();

    expect(renderer.root.findAllByProps({ accessibilityLabel: "Add a private note" })).toHaveLength(
      0,
    );

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "Like Sana" }).props.onPress();
      renderer.root.findByProps({ accessibilityLabel: "Skip Sana" }).props.onPress();
      renderer.root
        .findByProps({ accessibilityLabel: "Open Sana's full profile, 1 of 2" })
        .props.onPress();
    });

    expect(onInterested).toHaveBeenCalledWith(profile);
    expect(onNotForMe).toHaveBeenCalledWith(profile);
    expect(onOpen).toHaveBeenCalledWith(profile);
  });

  it("uses separate petal-blend and light decisions instead of a dark action rail", async () => {
    const { renderer } = await renderCard();
    const rail = renderer.root.findByProps({ accessibilityLabel: "Profile decisions" });
    expect(rail.props.style.backgroundColor).toBeUndefined();

    const like = renderer.root.findByProps({ accessibilityLabel: "Like Sana" });
    const skip = renderer.root.findByProps({ accessibilityLabel: "Skip Sana" });
    expect(like.props.style({ pressed: false })[1].backgroundColor).toBe("color-interestEnd");
    expect(skip.props.style({ pressed: false })[1].backgroundColor).toBe("color-alwaysWhite");
    expect(like.findByType("LinearGradient" as React.ElementType).props.colors).toEqual([
      "color-interestStart",
      "color-interestEnd",
    ]);
    expect(rail.props.style).toMatchObject({ flexDirection: "row", justifyContent: "center" });
  });

  it("clips a shallow bend into the photo without painting over the lower corners", async () => {
    const { renderer } = await renderCard();
    expect(renderer.root.findAllByType("PetalBackdrop" as React.ElementType)).toHaveLength(0);
    const mask = renderer.root.findByType("MaskedView" as React.ElementType);
    const curve = mask.props.maskElement;
    expect(curve.props.viewBox).toBe("0 0 100 100");
    expect(curve.props.children.props.fill).toBe("black");
    expect(curve.props.children.props.d).toContain("V92 Q100 96 96 96");
    expect(curve.props.children.props.d).toContain("Q0 96 0 92");
    expect(renderer.root.findAllByType("Svg" as React.ElementType)).toHaveLength(0);
    expect(
      renderer.root
        .findAllByType("LinearGradient" as React.ElementType)
        .some((gradient) => gradient.props.colors?.includes("color-blendSoftEnd")),
    ).toBe(false);
    const media = renderer.root
      .findAllByType("View" as React.ElementType)
      .find((view) => Array.isArray(view.props.style) && view.props.style[0]?.borderTopLeftRadius);
    expect(media?.props.style[0].borderWidth).toBeUndefined();
    expect(media?.props.style[0].borderRadius).toBeUndefined();
    expect(media?.props.style[0].backgroundColor).toBeUndefined();
  });
});
