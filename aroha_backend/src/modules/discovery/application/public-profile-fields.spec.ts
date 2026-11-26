import type { UserProfile } from "../../../generated/prisma/client";
import { mapDatingProfileFields } from "./public-profile-fields";

const eligible = { activeMatch: false, interests: [], lifestyle: null };

describe("Public work details", () => {
  it.each([false, undefined])(
    "keeps work private without explicit consent: %s",
    (shareWorkDetails) => {
      const profile = {
        occupation: "Engineer",
        shareWorkDetails,
      } as UserProfile;
      expect(mapDatingProfileFields(profile, eligible).occupation).toBeNull();
    },
  );

  it("only publishes work with consent", () => {
    expect(
      mapDatingProfileFields({
        occupation: "Engineer",
        shareWorkDetails: true,
      } as UserProfile, eligible).occupation,
    ).toBe("Engineer");
    expect(mapDatingProfileFields(null, eligible).occupation).toBeNull();
  });
  it("never publishes the private search category", () => {
    for (const shareWorkDetails of [false, true]) {
      expect(mapDatingProfileFields({
        occupationCategory: "TECHNOLOGY", shareWorkDetails,
      } as UserProfile, eligible)).not.toHaveProperty("occupationCategory");
    }
  });

  it("applies the Intro audience to prompts and resolves sensitive fields individually", () => {
    const fields: Partial<UserProfile> = {
      bio: "Synthetic intro",
      promptResponses: [{ promptId: "fixture", answer: "Synthetic prompt" }],
      religionSpirituality: "Synthetic religion",
      careerPriority: "HIGH",
      fieldAudiences: { intro: "MATCHES", religionSpirituality: "ONLY_ME", careerPriority: "ALL_ELIGIBLE" },
    };
    const profile = fields as UserProfile;
    expect(mapDatingProfileFields(profile, eligible)).toMatchObject({
      bio: null, profilePrompts: [], sensitiveCompatibility: { religionSpirituality: null, careerPriority: "HIGH" },
    });
    expect(mapDatingProfileFields(profile, { ...eligible, activeMatch: true })).toMatchObject({
      bio: profile.bio, profilePrompts: profile.promptResponses,
      sensitiveCompatibility: { religionSpirituality: null, careerPriority: "HIGH" },
    });
  });
});
