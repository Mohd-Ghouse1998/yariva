import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventListingDto, EventPageDto } from "../../types/events";
import { ApiError } from "../../api/errors";
import { translate } from "../../localization/translate";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  status: vi.fn(),
  push: vi.fn(),
  locate: vi.fn(),
  appState: undefined as undefined | ((state: string) => void),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mocks.push }),
  useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
}));
vi.mock("expo-image", () => ({ Image: (props: object) => React.createElement("Image", props) }));
vi.mock("react-native", () => ({
  View: ({ children, ...props }: React.PropsWithChildren<object>) =>
    React.createElement("View", props, children),
  Pressable: ({ children, ...props }: React.PropsWithChildren<object>) =>
    React.createElement("Pressable", props, children),
  RefreshControl: (props: object) => React.createElement("RefreshControl", props),
  FlatList: (props: {
    data: EventListingDto[];
    renderItem: (info: { item: EventListingDto }) => React.ReactNode;
    ListHeaderComponent: React.ReactNode;
    ListEmptyComponent: React.ReactNode;
    ListFooterComponent: React.ReactNode;
  }) =>
    React.createElement(
      "FlatList",
      props,
      props.ListHeaderComponent,
      props.data.length
        ? props.data.map((item) => (
            <React.Fragment key={item.id}>{props.renderItem({ item })}</React.Fragment>
          ))
        : props.ListEmptyComponent,
      props.ListFooterComponent,
    ),
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appState = listener;
      return {
        remove: () => {
          mocks.appState = undefined;
        },
      };
    },
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("../../api/endpoints/events", () => ({
  eventsApi: { list: mocks.list, status: mocks.status },
}));
vi.mock("../../utils/location", () => ({ captureCurrentLocation: mocks.locate }));
vi.mock("../../theme/ThemeContext", () => ({
  createThemeStyleHook: (factory: (palette: Record<string, string>) => object) => () =>
    factory(new Proxy({}, { get: (_target, name) => String(name) })),
  useTheme: () => ({ palette: { brandStrong: "brand", textSubdued: "muted" } }),
}));
vi.mock("../../theme/responsive", () => ({ useResponsiveLayout: () => ({ screenPadding: 20 }) }));
vi.mock("../../components/navigation/bottomNavigation", () => ({
  useBottomNavigationInset: () => 90,
}));
vi.mock("../../localization/LocalizationContext", () => ({
  useLocalization: () => ({
    language: "en",
    t: (key: string, params?: Record<string, string | number>) =>
      translate("en", "standard", key, params),
  }),
}));
vi.mock("../../components/layout/TabHeader", () => ({
  TabHeader: ({ right, title }: { right: React.ReactNode; title: string }) => (
    <>
      {title}
      {right}
    </>
  ),
}));
vi.mock("../../components/dating/SegmentedControl", () => ({
  SegmentedControl: (props: object) => React.createElement("Segments", props),
}));
vi.mock("../../components/datePlans/VenueArtwork", () => ({
  VenueArtwork: (props: object) => React.createElement("Artwork", props),
}));
vi.mock("../../components/ui/BottomSheet", () => ({
  BottomSheet: ({ visible, children, ...props }: React.PropsWithChildren<{ visible: boolean }>) =>
    visible ? React.createElement("Sheet", props, children) : null,
}));
vi.mock("../../components/ui/Button", () => ({
  Button: (props: object) => React.createElement("Button", props),
}));
vi.mock("../../components/ui/Chip", () => ({
  Chip: (props: object) => React.createElement("Chip", props),
}));
vi.mock("../../components/ui/Icon", () => ({
  Icon: (props: object) => React.createElement("Icon", props),
}));
vi.mock("../../components/ui/Input", () => ({
  Input: (props: object) => React.createElement("Input", props),
}));
vi.mock("../../components/ui/Text", () => ({
  Text: ({ children, ...props }: React.PropsWithChildren<object>) =>
    React.createElement("Text", props, children),
}));
vi.mock("../../components/ui/EmptyState", () => ({
  EmptyState: (props: { title: string; body: string }) =>
    React.createElement("EmptyState", props, props.title, props.body),
}));

import { EventsScreen } from "./EventsScreen";

const event = (id: string): EventListingDto =>
  ({
    id,
    title: `Event ${id}`,
    startsAt: "2030-10-30T12:00:00Z",
    timezone: "Asia/Kolkata",
    priceMinPaise: null,
    priceMaxPaise: null,
  }) as EventListingDto;
const page = (items: EventListingDto[] = [], nextCursor: string | null = null): EventPageDto => ({
  items,
  nextCursor,
  places: [],
  placesStatus: null,
});
const places = {
  ...page(),
  placesStatus: "MATCHES" as const,
  places: [
    {
      id: "reviewed-place",
      name: "Reviewed café",
      publicLocality: "Madhapur",
      reviewedAt: "2026-10-29T10:00:00Z",
      reviewSource: "Official source",
      distanceKm: null,
      priceMaxPerPerson: null,
    },
  ],
};
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let view: ReactTestRenderer;
const host = (name: string) => view.root.findByType(name as React.ElementType);
const button = (label: string) =>
  view.root
    .findAllByType("Button" as React.ElementType)
    .find((node) => node.props.label === label)!;
const texts = () =>
  view.root
    .findAll((node) => typeof node.type === "string")
    .flatMap((node) =>
      node.children.filter((child) => typeof child === "string" || typeof child === "number"),
    )
    .join(" ");
const mount = async () => {
  await act(async () => {
    view = create(<EventsScreen />);
  });
};
const click = async (label: string) => {
  await act(async () => {
    button(label).props.onPress();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status.mockResolvedValue({ enabled: true });
  mocks.list.mockResolvedValue(page());
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  vi.useRealTimers();
});

describe("Events main feed and real places fallback", () => {
  it("rechecks a loaded page at its original expiry even after pagination", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    const first = { ...event("expiring"), serverNow: "2030-10-29T12:00:00Z", availableUntil: "2030-10-29T12:00:10Z" };
    mocks.list.mockResolvedValueOnce(page([first], "next"));
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    mocks.list.mockResolvedValueOnce(page([{ ...event("later"), serverNow: "2030-10-29T12:00:04Z", availableUntil: "2030-10-29T12:00:30Z" }]));
    await act(async () => host("FlatList").props.onEndReached());
    mocks.list.mockResolvedValueOnce(page());
    await act(async () => { await vi.advanceTimersByTimeAsync(6001); });
    expect(mocks.list).toHaveBeenCalledTimes(3);
    expect(host("FlatList").props.data).toEqual([]);
  });
  it("shows places only after a successful empty discovery response and keeps My plans reachable", async () => {
    const pending = deferred<EventPageDto>();
    mocks.list.mockReturnValueOnce(pending.promise);
    await mount();
    expect(texts()).toContain("Loading events");
    expect(texts()).not.toContain("Places to meet");
    await act(async () => pending.resolve(places as EventPageDto));
    expect(texts()).toContain("Places to meet");
    expect(texts()).toContain("Reviewed café");
    expect(texts()).not.toContain("km away");
    expect(texts()).toContain("Price not confirmed");
    await click("My plans");
    expect(mocks.push).toHaveBeenCalledWith("/(app)/date-plan");
    await click("Plan here");
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/(app)/date-plan",
      params: { reviewedVenueId: "reviewed-place" },
    });
  });
  it("does not substitute places for an offline/error response or a pending refresh", async () => {
    mocks.list.mockResolvedValueOnce(places);
    await mount();
    const pending = deferred<EventPageDto>();
    mocks.list.mockReturnValueOnce(pending.promise);
    await act(async () => host("FlatList").props.refreshControl.props.onRefresh());
    expect(texts()).not.toContain("Places to meet");
    await act(async () => pending.reject(new TypeError("Network request failed")));
    expect(texts()).toContain("Events couldn’t load");
    expect(texts()).not.toContain("Reviewed café");
    mocks.list.mockResolvedValueOnce(places);
    await click("Retry");
    expect(texts()).toContain("Reviewed café");
  });
  it("keeps empty Saved private and separate from places, and drops an obsolete discovery response", async () => {
    const old = deferred<EventPageDto>();
    mocks.list.mockReturnValueOnce(old.promise);
    await mount();
    mocks.list.mockResolvedValueOnce(page());
    await act(async () => host("Segments").props.onChange("saved"));
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ saved: "true" }));
    expect(texts()).toContain("No saved events here");
    await act(async () => old.resolve(places as EventPageDto));
    expect(texts()).not.toContain("Places to meet");
    expect(texts()).not.toContain("Reviewed café");
  });
  it("does not call discovery when the pilot/adult capability is disabled", async () => {
    mocks.status.mockResolvedValueOnce({ enabled: false });
    await mount();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(texts()).toContain("Events aren’t available yet");
    expect(button("My plans")).toBeDefined();
    expect(texts()).not.toContain("Places to meet");
  });
  it("deduplicates pagination, retries the failed cursor and never substitutes places for an empty later page", async () => {
    mocks.list.mockResolvedValueOnce(page([event("one")], "cursor-one"));
    await mount();
    const next = deferred<EventPageDto>();
    mocks.list.mockReturnValueOnce(next.promise);
    await act(async () => {
      host("FlatList").props.onEndReached();
      host("FlatList").props.onEndReached();
    });
    expect(mocks.list).toHaveBeenCalledTimes(2);
    await act(async () => next.reject(new Error("Offline")));
    expect(host("FlatList").props.data.map((item: EventListingDto) => item.id)).toEqual(["one"]);
    mocks.list.mockResolvedValueOnce(page([event("one"), event("two")], "cursor-two"));
    await click("Retry");
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cursor-one" }));
    expect(host("FlatList").props.data.map((item: EventListingDto) => item.id)).toEqual([
      "one",
      "two",
    ]);
    mocks.list.mockResolvedValueOnce(places);
    await act(async () => host("FlatList").props.onEndReached());
    expect(texts()).not.toContain("Places to meet");
  });
  it("preserves manual filtering after permission denial without claiming nearby results", async () => {
    await mount();
    await click("Filters");
    mocks.locate.mockResolvedValueOnce({ ok: false, reason: "permission_denied" });
    await click("Use my location");
    expect(texts()).toContain("Enter a city and area");
    const inputs = view.root.findAllByType("Input" as React.ElementType);
    await act(async () => {
      inputs[0]!.props.onChangeText("Pune");
      inputs[1]!.props.onChangeText("Camp");
    });
    await click("Apply filters");
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ city: "Pune", area: "Camp" }),
    );
    expect(mocks.list.mock.calls.at(-1)![0].latitude).toBeUndefined();
  });
  it("uses consented approximate coordinates without persisting a profile or applying a dismissed location response", async () => {
    await mount();
    await click("Filters");
    const late = deferred<{
      ok: true;
      source: string;
      city: string;
      latitude: number;
      longitude: number;
    }>();
    mocks.locate.mockReturnValueOnce(late.promise);
    await act(async () => {
      button("Use my location").props.onPress();
    });
    await act(async () => host("Sheet").props.onClose());
    await act(async () =>
      late.resolve({
        ok: true,
        source: "current",
        city: "Pune",
        latitude: 18.52041,
        longitude: 73.85671,
      }),
    );
    await click("Filters");
    await click("Apply filters");
    expect(mocks.list.mock.calls.at(-1)![0].latitude).toBeUndefined();
    await click("Filters");
    mocks.locate.mockResolvedValueOnce({
      ok: true,
      source: "current",
      city: "Pune",
      latitude: 18.52041,
      longitude: 73.85671,
    });
    await click("Use my location");
    await click("Apply filters");
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ city: "Pune", latitude: 18.52, longitude: 73.857 }),
    );
  });
  it("clears saved/private rows on background and ignores late requests until a fresh resume", async () => {
    mocks.list.mockResolvedValueOnce(page([event("one")]));
    await mount();
    const pending = deferred<EventPageDto>();
    mocks.list.mockReturnValueOnce(pending.promise);
    await act(async () => host("FlatList").props.refreshControl.props.onRefresh());
    await act(async () => mocks.appState?.("background"));
    expect(host("FlatList").props.data).toEqual([]);
    await act(async () => pending.resolve(page([event("late")])));
    expect(host("FlatList").props.data).toEqual([]);
    mocks.list.mockResolvedValueOnce(page([event("fresh")]));
    await act(async () => mocks.appState?.("active"));
    expect(host("FlatList").props.data[0].id).toBe("fresh");
  });
  it("removes cached rows after an authoritative eligibility failure without showing places", async () => {
    mocks.list.mockResolvedValueOnce(page([event("private")], "next"));
    await mount();
    mocks.list.mockRejectedValueOnce(new ApiError(404, null));
    await act(async () => host("FlatList").props.onEndReached());
    expect(host("FlatList").props.data).toEqual([]);
    expect(texts()).not.toContain("Places to meet");
    mocks.list.mockResolvedValueOnce(page([event("fresh")]));
    await click("Retry");
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }));
  });
});
