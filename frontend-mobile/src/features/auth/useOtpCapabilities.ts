import { useEffect, useState } from "react";
import { authApi } from "../../api/endpoints/auth";

export type OtpAvailability = "loading" | "enabled" | "disabled";

export function useOtpCapabilities(): OtpAvailability {
  const [availability, setAvailability] = useState<OtpAvailability>("loading");

  useEffect(() => {
    let active = true;
    void authApi
      .capabilities()
      .then((value) => {
        if (active) setAvailability(value.otp.enabled ? "enabled" : "disabled");
      })
      .catch(() => {
        if (active) setAvailability("disabled");
      });
    return () => {
      active = false;
    };
  }, []);

  return availability;
}
