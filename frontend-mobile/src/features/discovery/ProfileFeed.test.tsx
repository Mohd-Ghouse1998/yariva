import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProfileDto } from "../../types/profile";

const scrollToOffset = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({
  FlatList: React.forwardRef(function MockFlatList(
    props: {
      data: PublicProfileDto[];
      renderItem: (info: { item: PublicProfileDto; index: number }) => React.ReactNode;
      ListEmptyComponent: React.ReactNode;
      ListHeaderComponent: React.ReactNode;
    },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({ scrollToOffset }));
    return React.createElement(
      "FlatList",
      props,
      props.ListHeaderComponent,
      props.data.length
        ? props.data.map((item: PublicProfileDto, index: number) =>
            React.createElement(
              React.Fragment,
              { key: item.userId },
              props.renderItem({ item, index }),
            ),
          )
        : props.ListEmptyComponent,
    );
  }),
  View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("View", props, children),
  RefreshControl: (props: Record<string, unknown>) => React.createElement("RefreshControl", props),
  useWindowDimensions: () => ({ width: 360, height: 780, fontScale: 1, scale: 3 }),
}));
vi.mock("../../components/dating/ProfilePreviewCard", () => ({
  ProfilePreviewCard: (props: Record<string, unknown>) =>
    React.createElement("ProfilePreviewCard", props),
}));

import { ProfileFeed } from "./ProfileFeed";

const people = ["a", "b", "c"].map((userId) => ({ userId }) as PublicProfileDto);
const setup = async (initial = people) => {
  const handlers = {
    onRefresh: vi.fn(),
    onOpen: vi.fn(),
    onInterested: vi.fn(),
    onNotForMe: vi.fn(),
    onViewed: vi.fn(),
  };
  let renderer!: ReactTestRenderer;
  const element = (profiles: PublicProfileDto[], selectedUserId?: string) => (
    <ProfileFeed
      profiles={profiles}
      header={<React.Fragment>Discover header and Scenes</React.Fragment>}
      refreshing={false}
      selectedUserId={selectedUserId}
      {...handlers}
      empty={<React.Fragment>Finished</React.Fragment>}
    />
  );
  await act(async () => {
    renderer = create(element(initial));
  });
  const list = () => renderer.root.findByType("FlatList" as React.ElementType);
  const measure = async (height: number) =>
    act(async () => list().props.onLayout({ nativeEvent: { layout: { height } } }));
  const measureHeader = async (height: number) =>
    act(async () =>
      list().props.ListHeaderComponent.props.onLayout({ nativeEvent: { layout: { height } } }),
    );
  const browse = async (y: number) =>
    act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y } } }));
  const update = async (profiles: PublicProfileDto[], selectedUserId?: string) =>
    act(async () => renderer.update(element(profiles, selectedUserId)));
  await measure(504);
  await measureHeader(250);
  return { renderer, list, measure, measureHeader, browse, update, handlers };
};

describe("one-profile Discover pages", () => {
  beforeEach(() => scrollToOffset.mockClear());
  it("keeps the first card full-height beneath a compact header, then snaps to each person", async () => {
    const { renderer, list, measureHeader, browse, update } = await setup();
    await measureHeader(120);
    expect(list().props.snapToOffsets).toEqual([0, 120, 624, 1128]);
    expect(list().props.getItemLayout(null, 0)).toEqual({ length: 504, offset: 120, index: 0 });
    expect(list().props.getItemLayout(null, 1)).toEqual({ length: 504, offset: 624, index: 1 });
    expect(
      renderer.root
        .findAllByType("ProfilePreviewCard" as React.ElementType)
        .map((card) => card.props.availableHeight),
    ).toEqual([500, 500, 500]);
    await browse(120);
    await update(people.map((person) => ({ ...person })));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 120, animated: false });
  });
  it("scrolls the real header away before exact viewport-sized profile pages", async () => {
    const { renderer, list } = await setup();
    expect(list().props).toMatchObject({
      disableIntervalMomentum: true,
      snapToOffsets: [0, 250, 754, 1258],
      decelerationRate: "fast",
    });
    expect(list().props.ListHeaderComponent).toBeDefined();
    expect(list().props.ItemSeparatorComponent).toBeUndefined();
    expect(list().props.getItemLayout(null, 2)).toEqual({ length: 504, offset: 1258, index: 2 });
    expect(
      renderer.root
        .findAllByType("ProfilePreviewCard" as React.ElementType)
        .map((card) => card.props.availableHeight),
    ).toEqual([500, 500, 500]);
  });
  it("browses without liking, skipping or opening a person", async () => {
    const { browse, handlers, list } = await setup();
    await browse(250);
    await browse(754);
    await browse(1258);
    await browse(754);
    expect(handlers.onInterested).not.toHaveBeenCalled();
    expect(handlers.onNotForMe).not.toHaveBeenCalled();
    expect(handlers.onOpen).not.toHaveBeenCalled();
    list().props.refreshControl.props.onRefresh();
    expect(handlers.onRefresh).toHaveBeenCalledOnce();
  });
  it("preserves the header position at the top and the full first card after refresh", async () => {
    const { browse, update, measureHeader } = await setup();
    await update(people.map((person) => ({ ...person })));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
    await browse(250);
    await update(people.map((person) => ({ ...person })));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 250, animated: false });
    await measureHeader(300);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 300, animated: false });
    await browse(0);
    await update(people.map((person) => ({ ...person })));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  });
  it("preserves fractional viewport heights without accumulating snap drift", async () => {
    const { measure, browse, list } = await setup();
    await measure(504.5);
    expect(list().props.snapToOffsets).toEqual([0, 250, 754.5, 1259]);
    expect(list().props.getItemLayout(null, 2)).toEqual({ length: 504.5, offset: 1259, index: 2 });
    await browse(1259);
    await measure(630.25);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1510.5, animated: false });
  });
  it("browses without an automatic top-header mutation callback", async () => {
    const { browse, list, measure } = await setup();
    await browse(754);
    expect(list().props.onMomentumScrollEnd).toBeUndefined();
    await measure(630);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 880, animated: false });
  });
  it("keeps the current person across refreshed objects and viewport resizing", async () => {
    const { browse, update, measure } = await setup();
    await browse(754);
    await update(people.map((person) => ({ ...person })));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 754, animated: false });
    await measure(360);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 610, animated: false });
  });
  it("aligns to the successor after removal and preserves it when Undo inserts a card before it", async () => {
    const { browse, update } = await setup();
    await browse(754);
    await update([people[0], people[2]]);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 754, animated: false });
    await update(people);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1258, animated: false });
  });
  it("clamps the last removal, handles empty/restored feeds and reordered filter results", async () => {
    const { browse, update, renderer } = await setup();
    await browse(1258);
    await update(people.slice(0, 2));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 754, animated: false });
    await update([people[1], people[0]]);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 250, animated: false });
    await update([]);
    expect(renderer.root.findAllByType("ProfilePreviewCard" as React.ElementType)).toHaveLength(0);
    await update([people[2]]);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 250, animated: false });
    expect(renderer.root.findAllByType("ProfilePreviewCard" as React.ElementType)).toHaveLength(1);
  });
  it("keeps explicit photo/profile decisions wired and selected state without resizing", async () => {
    const { renderer, update, handlers } = await setup();
    await update(people, "b");
    const card = renderer.root.findAllByType("ProfilePreviewCard" as React.ElementType)[1];
    expect(card.props.interestSelected).toBe(true);
    card.props.onInterested(people[1]);
    card.props.onNotForMe(people[1]);
    card.props.onOpen(people[1]);
    expect(handlers.onInterested).toHaveBeenCalledWith(people[1]);
    expect(handlers.onNotForMe).toHaveBeenCalledWith(people[1]);
    expect(handlers.onOpen).toHaveBeenCalledWith(people[1]);
  });
});
