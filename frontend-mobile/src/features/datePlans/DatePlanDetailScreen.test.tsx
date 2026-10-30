import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../localization/translate";
import type { DatePlanDto } from "../../types/datePlan";
import type { NotificationDto } from "../../types/notifications";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), match: vi.fn(), accept: vi.fn(), push: vi.fn(), toast: { show: vi.fn() },
  blur: undefined as undefined | (() => void),
  appState: undefined as undefined | ((state: string) => void),
  notice: undefined as undefined | ((event: { notification: NotificationDto }) => void),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ datePlanId: "plan-1" }), useRouter: () => ({ push: mocks.push }),
  useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(() => {
    const cleanup = effect(); mocks.blur = cleanup || undefined; return cleanup;
  }, [effect]),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "Spinner", Pressable: "Pressable", ScrollView: "ScrollView", View: "View",
  Alert: { alert: vi.fn() }, Linking: { openURL: vi.fn() }, Share: { share: vi.fn() },
  AppState: { currentState: "active", addEventListener: (_: string, callback: typeof mocks.appState) => {
    mocks.appState = callback; return { remove: () => { mocks.appState = undefined; } };
  } },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../../api/endpoints/datePlans", () => ({ datePlansApi: { get: mocks.get, accept: mocks.accept } }));
vi.mock("../../api/endpoints/matches", () => ({ matchesApi: { get: mocks.match } }));
vi.mock("../../auth", () => ({ useAuth: () => ({ user: { id: "recipient" } }) }));
vi.mock("../../hooks/useCurrentTime", () => ({ useCurrentTime: () => Date.parse("2026-10-29T12:00:00Z") }));
vi.mock("../../navigation/useSafeBack", () => ({ useSafeBack: () => vi.fn() }));
vi.mock("../../components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("../../localization/LocalizationContext", () => ({ useLocalization: () => localization }));
const localization = { t: (key: string, params?: Record<string, string | number>) => translate("en", "standard", key, params) };
vi.mock("../../realtime/RealtimeProvider", () => {
  const realtime = { onNotification: (callback: typeof mocks.notice) => {
    mocks.notice = callback; return () => { mocks.notice = undefined; };
  } }; return { useRealtime: () => realtime };
});
vi.mock("../../theme/ThemeContext", () => ({
  createThemeStyleHook: (factory: (palette: Record<string, string>) => object) => () => factory(new Proxy({}, { get: (_target, key) => String(key) })),
  useTheme: () => ({ palette: {} }),
}));
vi.mock("../../components/dating", () => ({ SegmentedControl: "Segments" }));
vi.mock("../../components/datePlans/VenueArtwork", () => ({ VenueArtwork: "VenueArtwork" }));
vi.mock("../../components/layout/Header", () => ({ Header: "Header" }));
vi.mock("../../components/ui/Badge", () => ({ Badge: "Badge" }));
vi.mock("../../components/ui/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button", ButtonRow: "ButtonRow" }));
vi.mock("../../components/ui/Card", () => ({ Card: "Card" }));
vi.mock("../../components/ui/CenterDialog", () => ({ CenterDialog: ({ visible, children }: React.PropsWithChildren<{ visible: boolean }>) => visible ? <>{children}</> : null }));
vi.mock("../../components/ui/Chip", () => ({ Chip: "Chip" }));
vi.mock("../../components/ui/Icon", () => ({ Icon: "Icon" }));
vi.mock("../../components/ui/Input", () => ({ Input: "Input" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("./DateTimeFields", () => ({ DateTimeFields: "DateTimeFields" }));

import { DatePlanDetailScreen } from "./DatePlanDetailScreen";

const plan = { id: "plan-1", matchId: "match-1", createdByUserId: "proposer", status: "PROPOSED", proposalVersion: 1,
  eventId: "event-1", eventVersion: 1, eventChanged: false, eventUnavailable: false,
  title: "TEST original agreement", description: "Original details", activityType: "EVENT", proposedStartAt: "2030-01-01T12:00:00Z",
  durationMinutes: 120, timezone: "Asia/Kolkata", publicLocality: "Madhapur", responses: [] } as unknown as DatePlanDto;
const notice = (datePlanId = plan.id): { notification: NotificationDto } => ({ notification: { id: "notice", type: "DATE_CHANGED", channel: "PUSH", title: "Event changed", body: "Review your plan", actor: null,
  status: "PENDING", readAt: null, sentAt: null, createdAt: "2026-10-29T12:00:00Z", data: { route: "event-plan-change", eventId: plan.eventId, datePlanId } } });
let view: ReactTestRenderer;
const button = (label: string) => view.root.findAllByType("Button" as React.ElementType).find(node => node.props.label === label);
const mount = async () => { await act(async () => { view = create(<DatePlanDetailScreen />); }); };
beforeEach(() => {
  vi.clearAllMocks(); mocks.get.mockResolvedValue(plan);
  mocks.match.mockResolvedValue({ otherUser: { displayName: "TEST match", photos: [] } });
});
afterEach(async () => { await act(async () => view?.unmount()); });

describe("authoritative event-plan refresh", () => {
  it("clears old actions while rechecking a private change notice, then requires review of the latest event", async () => {
    await mount(); expect(button("Accept meetup")?.props.disabled).toBeFalsy();
    let finish!: (value: DatePlanDto) => void;
    mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => mocks.notice?.(notice()));
    expect(button("Accept meetup")).toBeUndefined();
    await act(async () => finish({ ...plan, eventChanged: true }));
    expect(button("Accept meetup")?.props.disabled).toBe(true);
    await act(async () => button("Review latest event")?.props.onPress());
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/(app)/events/[eventId]", params: { eventId: plan.eventId } });
  });

  it("ignores notices for another plan and late mutation results after background/resume reauthorization", async () => {
    await mount(); await act(async () => mocks.notice?.(notice("another-plan")));
    expect(mocks.get).toHaveBeenCalledTimes(1);
    let finish!: (value: DatePlanDto) => void;
    mocks.accept.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => button("Accept meetup")?.props.onPress());
    await act(async () => mocks.appState?.("background"));
    expect(button("Accept meetup")).toBeUndefined();
    mocks.get.mockResolvedValueOnce({ ...plan, eventChanged: true, eventUnavailable: true });
    await act(async () => mocks.appState?.("active"));
    await act(async () => finish({ ...plan, status: "ACCEPTED" }));
    expect(button("Accept meetup")?.props.disabled).toBe(true);
    expect(mocks.toast.show).not.toHaveBeenCalledWith("Meetup accepted.", "success");
    expect(button("Review latest event")).toBeDefined();
  });

  it("does not restore a plan from a request that completes after blur", async () => {
    let finish!: (value: DatePlanDto) => void;
    mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await mount(); await act(async () => mocks.blur?.());
    await act(async () => finish(plan));
    expect(mocks.notice).toBeUndefined();
    expect(button("Accept meetup")).toBeUndefined();
  });
});
