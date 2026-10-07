import { useLocalSearchParams } from "expo-router";
import { WingmanScreen } from "../../../../src/features/wingman/WingmanScreen";

export default function WingmanInviteRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <WingmanScreen inviteToken={typeof token === "string" ? token : undefined} />;
}
