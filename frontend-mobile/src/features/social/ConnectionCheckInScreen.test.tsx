import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { socialApi, type CheckIn } from "../../api/endpoints/social";
import { Button } from "../../components/ui/Button";
import { ConnectionCheckInScreen } from "./ConnectionCheckInScreen";

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ conversationId: "chat" }),
  useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
}));
vi.mock("react-native", () => ({
  View: "View",
  AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("../../api/endpoints/social", () => ({ socialApi: { checkIn: vi.fn() } }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/Input", () => ({ Input: "Input" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("./SocialScreen", () => ({ SocialScreen: "SocialScreen", SocialCard: "SocialCard" }));

it("refreshes a peer's withdrawn agreement while focused and preserves an unsaved choice", async () => {
  const shared: CheckIn = {
    intent: { version: 2, mine: "FRIENDSHIP", common: "FRIENDSHIP", pending: false },
    vibe: { version: 0, prompts: [], state: "IDLE", mine: [], theirs: [] },
  };
  vi.mocked(socialApi.checkIn)
    .mockResolvedValueOnce(shared)
    .mockResolvedValue({ ...shared, intent: { version: 3, mine: null, common: null, pending: false } });
  vi.useFakeTimers();
  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => { view = create(<ConnectionCheckInScreen />); });
    const buttons = () => view!.root.findAllByType(Button);
    const text = () => JSON.stringify(view!.toJSON());
    expect(text()).toContain("You both chose friendship.");
    await act(async () => buttons().find((button) => button.props.label === "Dating")!.props.onPress());
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(text()).not.toContain("You both chose friendship.");
    expect(buttons().find((button) => button.props.label === "Dating")!.props.accessibilityState.selected).toBe(true);
    expect(buttons().find((button) => button.props.label === "Save intention")!.props.disabled).toBe(false);
  } finally {
    await act(async () => view?.unmount());
    vi.useRealTimers();
  }
});

it("renders a neutral invitation before the recipient chooses an intention", async () => {
  vi.mocked(socialApi.checkIn).mockResolvedValue({
    intent: { version: 1, mine: null, common: null, pending: true },
    vibe: { version: 0, prompts: [], state: "IDLE", mine: [], theirs: [] },
  });
  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => { view = create(<ConnectionCheckInScreen />); });
    const text = JSON.stringify(view!.toJSON());
    expect(text).toContain("An intention check-in is open.");
    expect(text).not.toContain("You both chose");
  } finally {
    await act(async () => view?.unmount());
  }
});
