import React from "react";
import type { CircleActivity } from "../../api/endpoints/social";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { SocialCard } from "./SocialScreen";

export function stateLabel(state: string) {
  if (state === "APPROVED") return "Confirmed";
  if (state === "REMOVED") return "Removed by organizer";
  return state[0]!.toUpperCase() + state.slice(1).toLowerCase();
}

export function ActivityReceipt({ activity, saving, withdraw }: {
  activity: CircleActivity;
  saving: boolean;
  withdraw: (need: number) => void;
}) {
  return (
    <SocialCard>
      <Text variant="bodyStrong" accessibilityRole="header">Activity · {stateLabel(activity.state)}</Text>
      {activity.mine.map(({ need, status }) => (
        <React.Fragment key={need}>
          <Text>{need === 0 ? "Attendance" : "Volunteer response"} · Previous status · {stateLabel(status)}</Text>
          {activity.state === "UNAVAILABLE" && (status === "APPROVED" || status === "PENDING") ? (
            <Button label={need === 0 ? "Withdraw attendance" : `Withdraw volunteer response ${need}`} disabled={saving}
              variant="secondary" onPress={() => withdraw(need)} />
          ) : null}
        </React.Fragment>
      ))}
    </SocialCard>
  );
}
