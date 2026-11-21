import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { socialApi, type CircleSummary } from "../../api/endpoints/social";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { CirclesScreen } from "./CirclesScreen";

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
}));
vi.mock("../../api/endpoints/social", () => ({ socialApi: { list: vi.fn() } }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/Input", () => ({ Input: "Input" }));
vi.mock("../../components/ui/Text", () => ({ Text: "Text" }));
vi.mock("./SocialScreen", () => ({ SocialScreen: "SocialScreen", SocialCard: "SocialCard" }));

const terminal: CircleSummary = {
  id: "closed", title: "Closed group", redacted: true, description: "", intent: null, locality: "",
  capacity: 0, approvedCount: 0, ownStatus: "APPROVED", state: "CLOSED", organizer: true,
  activities: [{
    id: "cancelled", redacted: true, title: "", description: "", state: "CANCELLED", startsAt: null, venue: null,
    openToNearby: false, helpNeeds: [], capacity: 0, approvedCount: 0, version: 0, mine: [{ need: 0, status: "APPROVED" }],
  }],
};

it("prioritizes terminal outcomes and keeps the two pagination controls independent", async () => {
  vi.mocked(socialApi.list).mockImplementation(async (scope, cursor) => {
    if (scope === "own") return { items: [terminal], nextCursor: cursor ? null : "own-cursor" };
    return { items: [], nextCursor: cursor ? null : "nearby-cursor" };
  });
  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => { view = create(<CirclesScreen />); });
    const buttons = () => view!.root.findAllByType(Button);
    const text = view!.root.findAllByType(Text).map(node => node.children.join(""));
    expect(text).toContain("Activity · Cancelled");
    expect(text).toContain("Attendance · Previous status · Confirmed");
    const labels = buttons().map(({ props }) => props.label);
    expect(labels).not.toContain("Close circle");
    expect(labels).not.toContain("Withdraw attendance");
    await act(async () => buttons().find(({ props }) => props.label === "Load more nearby")!.props.onPress());
    expect(socialApi.list).toHaveBeenLastCalledWith("nearby", "nearby-cursor");
    await act(async () => buttons().find(({ props }) => props.label === "Load more of your circles")!.props.onPress());
    expect(socialApi.list).toHaveBeenLastCalledWith("own", "own-cursor");
    expect(JSON.stringify(view!.toJSON()).match(/Closed group/g)).toHaveLength(1);
  } finally {
    await act(async () => view?.unmount());
  }
});
