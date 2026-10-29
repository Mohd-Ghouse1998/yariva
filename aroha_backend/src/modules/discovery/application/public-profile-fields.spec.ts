import type { UserProfile } from "../../../generated/prisma/client";
import { mapDatingProfileFields } from "./public-profile-fields";

describe("Public work details", () => {
  it.each([false, undefined])(
    "keeps work private without explicit consent: %s",
    (shareWorkDetails) => {
      const profile = {
        occupation: "Engineer",
        shareWorkDetails,
      } as UserProfile;
      expect(mapDatingProfileFields(profile).occupation).toBeNull();
    },
  );

  it("only publishes work with consent", () => {
    expect(
      mapDatingProfileFields({
        occupation: "Engineer",
        shareWorkDetails: true,
      } as UserProfile).occupation,
    ).toBe("Engineer");
    expect(mapDatingProfileFields(null).occupation).toBeNull();
  });
  it("never publishes the private search category", () => {
    for (const shareWorkDetails of [false, true]) {
      expect(mapDatingProfileFields({
        occupationCategory: "TECHNOLOGY", shareWorkDetails,
      } as UserProfile)).not.toHaveProperty("occupationCategory");
    }
  });

});
