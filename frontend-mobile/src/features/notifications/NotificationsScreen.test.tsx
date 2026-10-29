import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationDto } from "../../types/notifications";

const mocks = vi.hoisted(() => ({
  list: vi.fn(), read: vi.fn(), push: vi.fn(), toast: { show: vi.fn() },
  focus: undefined as (() => (() => void) | void) | undefined,
  blur: undefined as (() => void) | undefined,
  appState: undefined as ((state: string) => void) | undefined,
  event: undefined as ((event: { notification: NotificationDto }) => void) | undefined,
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mocks.push }),
  useFocusEffect: (effect: () => (() => void) | void) => React.useEffect(() => {
    mocks.focus = effect;
    mocks.blur = effect() || undefined;
    return () => mocks.blur?.();
  }, [effect]),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", FlatList: "FlatList", Pressable: "Pressable", View: "View",
  AppState: { currentState: "active", addEventListener: (_: string, callback: (state: string) => void) => {
    mocks.appState = callback;
    return { remove: () => { mocks.appState = undefined; } };
  } },
}));
vi.mock("../../api/endpoints/notifications", () => ({ notificationsApi: { list: mocks.list, read: mocks.read } }));
vi.mock("../../components/layout", () => ({ Header: "Header", Screen: "Screen" }));
vi.mock("../../components/ui/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/EmptyState", () => ({ EmptyState: "EmptyState" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("../../components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("../../navigation/useSafeBack", () => ({ useSafeBack: () => vi.fn() }));
vi.mock("../../realtime/RealtimeProvider", () => {
  const realtime = { onNotification: (callback: typeof mocks.event) => {
    mocks.event = callback;
    return () => { mocks.event = undefined; };
  } };
  return { useRealtime: () => realtime };
});
vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ palette: {} }),
  createThemeStyleHook: (factory: (palette: object) => object) => () => factory({}),
}));

import { NotificationsScreen } from "./NotificationsScreen";

const ordinaryNotice: NotificationDto = { id: "ordinary", type: "SYSTEM", channel: "PUSH", title: "Update", body: "An update is available.",
  actor: null, status: "PENDING", readAt: null, sentAt: null, createdAt: "2026-10-19T00:00:00.000Z", data: {} };
const privateNotice: NotificationDto = { ...ordinaryNotice, id: "private", data: { route: "private-story", storyId: "story" } };
const page = (items: NotificationDto[]) => ({ items, nextCursor: null });
const rows = (view: ReactTestRenderer) => view.root.findByType("FlatList" as React.ElementType).props.data;

describe("private activity lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears private rows on blur and ignores a read that finishes after blur", async () => {
    mocks.list.mockResolvedValueOnce(page([privateNotice, ordinaryNotice]));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<NotificationsScreen />); });
    expect(rows(view)).toEqual([privateNotice, ordinaryNotice]);
    let finish!: (value: ReturnType<typeof page>) => void;
    mocks.list.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => { mocks.event?.({ notification: privateNotice }); });
    await act(async () => { mocks.blur?.(); });
    expect(rows(view)).toEqual([ordinaryNotice]);
    expect(mocks.event).toBeUndefined();
    await act(async () => { finish(page([privateNotice])); });
    expect(rows(view)).toEqual([ordinaryNotice]);
    mocks.list.mockResolvedValueOnce(page([]));
    await act(async () => { mocks.blur = mocks.focus?.() || undefined; });
    expect(rows(view)).toEqual([]);
    await act(async () => view.unmount());
  });

  it("clears private rows on background and rechecks the server on resume", async () => {
    mocks.list.mockResolvedValueOnce(page([privateNotice, ordinaryNotice]));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<NotificationsScreen />); });
    await act(async () => { mocks.appState?.("background"); });
    expect(rows(view)).toEqual([ordinaryNotice]);
    const calls = mocks.list.mock.calls.length;
    await act(async () => { mocks.event?.({ notification: privateNotice }); });
    expect(mocks.list).toHaveBeenCalledTimes(calls);
    mocks.list.mockResolvedValueOnce(page([ordinaryNotice]));
    await act(async () => { mocks.appState?.("active"); });
    expect(mocks.list).toHaveBeenCalledTimes(calls + 1);
    expect(rows(view)).toEqual([ordinaryNotice]);
    await act(async () => view.unmount());
  });
});
