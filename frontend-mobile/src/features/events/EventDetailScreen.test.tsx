import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import type { EventListingDto } from "../../types/events";
import type { NotificationDto } from "../../types/notifications";
import { translate } from "../../localization/translate";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  unsave: vi.fn(),
  matches: vi.fn(),
  create: vi.fn(),
  push: vi.fn(),
  uuid: vi.fn(),
  blur: undefined as undefined | (() => void),
  appState: undefined as undefined | ((state: string) => void),
  notification: undefined as undefined | ((event: { notification: NotificationDto }) => void),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ eventId: "event-1" }),
  useRouter: () => ({ push: mocks.push }),
  useFocusEffect: (effect: () => void | (() => void)) =>
    React.useEffect(() => {
      const cleanup = effect();
      mocks.blur = cleanup || undefined;
      return cleanup;
    }, [effect]),
}));
vi.mock("expo-modules-core", () => ({ uuid: { v4: mocks.uuid } }));
vi.mock("expo-image", () => ({ Image: (props: object) => React.createElement("Image", props) }));
vi.mock("react-native", () => ({
  View: ({ children }: React.PropsWithChildren) => React.createElement("View", {}, children),
  ScrollView: ({ children }: React.PropsWithChildren) =>
    React.createElement("ScrollView", {}, children),
  Modal: ({ visible, children }: React.PropsWithChildren<{ visible: boolean }>) =>
    visible ? <>{children}</> : null,
  Pressable: ({ children, ...props }: React.PropsWithChildren<object>) =>
    React.createElement("Pressable", props, children),
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn() },
  AppState: { currentState: "active", addEventListener: (_: string, callback: typeof mocks.appState) => {
    mocks.appState = callback;
    return { remove: () => { mocks.appState = undefined; } };
  } },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("../../api/endpoints/events", () => ({
  eventsApi: { get: mocks.get, save: mocks.save, unsave: mocks.unsave },
}));
vi.mock("../../api/endpoints/matches", () => ({ matchesApi: { list: mocks.matches } }));
vi.mock("../../api/endpoints/datePlans", () => ({ datePlansApi: { create: mocks.create } }));
vi.mock("../../theme/ThemeContext", () => ({
  createThemeStyleHook: (factory: (palette: Record<string, string>) => object) => () =>
    factory(new Proxy({}, { get: (_target, key) => String(key) })),
}));
vi.mock("../../navigation/useSafeBack", () => ({ useSafeBack: () => vi.fn() }));
vi.mock("../../localization/LocalizationContext", () => ({
  useLocalization: () => localization,
}));
const localization = { language: "en", t: (key: string, params?: Record<string, string | number>) => translate("en", "standard", key, params) };
vi.mock("../../realtime/RealtimeProvider", () => {
  const realtime = { onNotification: (callback: typeof mocks.notification) => {
    mocks.notification = callback;
    return () => { mocks.notification = undefined; };
  } };
  return { useRealtime: () => realtime };
});
vi.mock("../../components/layout/Header", () => ({ Header: () => null }));
vi.mock("../../components/ui/Button", () => ({
  Button: (props: object) => React.createElement("Button", props),
}));
vi.mock("../../components/ui/Card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("../../components/ui/Text", () => ({
  Text: ({ children }: React.PropsWithChildren) => React.createElement("Text", {}, children),
}));
vi.mock("../../components/ui/Avatar", () => ({ Avatar: () => null }));
import { EventDetailScreen } from "./EventDetailScreen";
const event = {
  id: "event-1",
  version: 1,
  title: "TEST public arts",
  description: "A public event",
  category: "CULTURE",
  status: "PUBLISHED",
  city: "Hyderabad",
  locality: "Madhapur",
  venueName: "Arts centre",
  venueAddress: "Madhapur",
  startsAt: "2030-10-30T12:00:00Z",
  endsAt: "2030-10-30T14:00:00Z",
  timezone: "Asia/Kolkata",
  priceMinPaise: null,
  priceMaxPaise: null,
  currency: "INR",
  sourceUrl: "https://example.com/event",
  sourceName: "Organizer",
  verifiedAt: "2026-10-29T10:00:00Z",
  saved: false,
  unavailable: false,
} as EventListingDto;
const matches = {
  items: [
    { id: "match-1", status: "ACTIVE", otherUser: { displayName: "TEST match", photos: [] } },
  ],
  nextCursor: null,
};
let view: ReactTestRenderer;
const button = (label: string) =>
  view.root
    .findAllByType("Button" as React.ElementType)
    .find((node) => node.props.label === label)!;
const click = async (label: string) => {
  await act(async () => {
    button(label).props.onPress();
  });
};
const select = async () => {
  await act(async () =>
    view.root
      .findAllByType("Pressable" as React.ElementType)
      .find((node) => node.props.accessibilityRole === "radio")!
      .props.onPress(),
  );
};
const mount = async () => {
  await act(async () => {
    view = create(<EventDetailScreen />);
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(event);
  mocks.matches.mockResolvedValue(matches);
  let id = 0;
  mocks.uuid.mockImplementation(() => `uuid-${++id}`);
});
afterEach(async () => {
  await act(async () => view?.unmount());
  vi.useRealTimers();
});

describe("Event freshness and private lifecycle", () => {
  it("rereads a listing cancelled while a private save was pending", async () => {
    await mount();
    mocks.save.mockRejectedValueOnce(new ApiError(409, null));
    mocks.get.mockResolvedValueOnce({ ...event, version: 2, status: "CANCELLED", unavailable: true });
    await click("Save privately");
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(button("Invite a match").props.disabled).toBe(true);
    expect(button("Save privately").props.disabled).toBe(true);
  });
  it("drops background reads and revalidates cancellation on resume", async () => {
    let finish!: (value: EventListingDto) => void;
    mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await mount();
    await act(async () => mocks.appState?.("background"));
    mocks.get.mockResolvedValueOnce({ ...event, version: 2, status: "CANCELLED", unavailable: true });
    await act(async () => mocks.appState?.("active"));
    expect(button("Invite a match").props.disabled).toBe(true);
    await act(async () => finish(event));
    expect(button("Invite a match").props.disabled).toBe(true);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("closes the match picker and rereads at the server freshness deadline despite device clock skew", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    mocks.get.mockResolvedValueOnce({ ...event, serverNow: "2030-10-29T12:00:00Z", availableUntil: "2030-10-29T12:00:10Z" });
    await mount();
    await click("Invite a match");
    await select();
    mocks.get.mockResolvedValueOnce({ ...event, unavailable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(button("Send invitation")).toBeUndefined();
    expect(button("Invite a match").props.disabled).toBe(true);
  });

  it("reauthorizes a private change notice and ignores an invitation response from the old version", async () => {
    await mount();
    await click("Invite a match");
    await select();
    let finish!: (value: { id: string }) => void;
    mocks.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await click("Send invitation");
    mocks.get.mockResolvedValueOnce({ ...event, version: 2, unavailable: true, status: "CANCELLED" });
    await act(async () => mocks.notification?.({ notification: { id: "notice", type: "DATE_CHANGED", channel: "PUSH", title: "Event changed", body: "Review your plan", actor: null,
      status: "PENDING", readAt: null, sentAt: null, createdAt: event.verifiedAt, data: { route: "event-plan-change", eventId: event.id } } }));
    await act(async () => finish({ id: "old-version-plan" }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(button("Send invitation")).toBeUndefined();
    expect(button("Invite a match").props.disabled).toBe(true);
  });

  it("cancels expiry work when the screen leaves focus", async () => {
    vi.useFakeTimers();
    mocks.get.mockResolvedValueOnce({ ...event, serverNow: event.verifiedAt, availableUntil: new Date(Date.parse(event.verifiedAt) + 1000).toISOString() });
    await mount();
    await act(async () => mocks.blur?.());
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});

describe("Event details invitation recovery", () => {
  it("reuses one retry identity after a network failure and prevents double submissions", async () => {
    await mount();
    await click("Invite a match");
    await select();
    let reject!: (reason: Error) => void;
    mocks.create.mockReturnValueOnce(
      new Promise((_resolve, no) => {
        reject = no;
      }),
    );
    await act(async () => {
      button("Send invitation").props.onPress();
      button("Send invitation").props.onPress();
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("Offline")));
    mocks.create.mockResolvedValueOnce({ id: "plan-1" });
    await click("Send invitation");
    expect(mocks.create.mock.calls[0]![1].idempotencyKey).toBe(
      mocks.create.mock.calls[1]![1].idempotencyKey,
    );
    expect(mocks.push).toHaveBeenLastCalledWith({
      pathname: "/(app)/date-plan/[datePlanId]",
      params: { datePlanId: "plan-1" },
    });
  });
  it("drops selection on match reload and disables inviting a no-longer-listed match", async () => {
    await mount();
    await click("Invite a match");
    await select();
    mocks.create.mockRejectedValueOnce(new Error("Offline"));
    await click("Send invitation");
    mocks.matches.mockResolvedValueOnce({ items: [], nextCursor: null });
    await click("Reload matches");
    expect(button("Send invitation").props.disabled).toBe(true);
    expect(
      view.root
        .findAllByType("Pressable" as React.ElementType)
        .filter((node) => node.props.accessibilityRole === "radio"),
    ).toHaveLength(0);
  });
  it("requires review and a new selection/key after a listing version conflict", async () => {
    await mount();
    await click("Invite a match");
    await select();
    mocks.create.mockRejectedValueOnce(new ApiError(409, null));
    mocks.get.mockResolvedValueOnce({ ...event, version: 2 });
    await click("Send invitation");
    expect(button("Send invitation")).toBeUndefined();
    await click("Invite a match");
    expect(button("Send invitation").props.disabled).toBe(true);
    await select();
    mocks.create.mockResolvedValueOnce({ id: "plan-2" });
    await click("Send invitation");
    expect(mocks.create.mock.calls[1]![1]).toMatchObject({ eventVersion: 2 });
    expect(mocks.create.mock.calls[1]![1].idempotencyKey).not.toBe(
      mocks.create.mock.calls[0]![1].idempotencyKey,
    );
  });
  it("keeps cancellation disabled, offers reporting, and ignores a save response after leaving", async () => {
    await mount();
    await click("Report listing");
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/(app)/report",
      params: { targetType: "EVENT_LISTING", targetId: "event-1" },
    });
    let resolve!: (result: EventListingDto) => void;
    mocks.save.mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes;
      }),
    );
    await click("Save privately");
    await act(async () => mocks.blur?.());
    await act(async () => resolve({ ...event, saved: true }));
    expect(button("Saved · remove")).toBeUndefined();
    mocks.get.mockResolvedValueOnce({ ...event, status: "CANCELLED", unavailable: true });
    await act(async () => {
      view.unmount();
      view = create(<EventDetailScreen />);
    });
    expect(button("Invite a match").props.disabled).toBe(true);
  });
});
