import { describe, expect, it } from "vitest";
import type { MyProfileDto } from "../../types/profile";
import {
  editFormToProfileUpdate,
  moveProfilePhoto,
  profileEditSignature,
  profileExtrasUpdate,
  profileToEditForm,
  validateProfileEditForm,
} from "./profileEditForm";

const profile = {
  headline: " Hello ",
  bio: "A sufficiently thoughtful profile bio.",
  languages: ["Telugu", "English"],
  foodPreferences: ["Vegetarian"],
  preferredRelationshipPace: "SLOW_AND_STEADY",
  relocationOpenness: null,
  careerPriority: "Balanced",
  familyInvolvementComfort: null,
  marriageTimeline: null,
  childrenPreference: null,
  religionSpirituality: null,
  shareSensitiveCompatibility: false,
  promptResponses: [{ promptId: "ideal_sunday", answer: "A long walk" }],
} as unknown as MyProfileDto;

describe("profile edit form", () => {
  it("keeps work private by default and saves explicit visibility independently", () => {
    const form = profileToEditForm(profile);
    expect(form.occupation).toBe("");
    expect(form.occupationCategory).toBeNull();
    expect(form.shareWorkDetails).toBe(false);
    const shared = profileToEditForm({
      ...profile,
      occupation: " Engineer ",
      occupationCategory: "TECHNOLOGY",
      shareWorkDetails: true,
    });
    expect(profileExtrasUpdate(shared, false)).toMatchObject({
      occupation: "Engineer",
      occupationCategory: "TECHNOLOGY",
      shareWorkDetails: true,
    });
    expect(profileExtrasUpdate({ ...shared, occupation: " " }, false).occupation).toBeNull();
    expect(profileExtrasUpdate({ ...shared, occupationCategory: null }, false).occupationCategory).toBeNull();
    expect(profileExtrasUpdate(shared, true)).not.toHaveProperty("occupationCategory");
    expect(profileExtrasUpdate(shared, true)).not.toHaveProperty("occupation");
    expect(validateProfileEditForm({ ...form, occupation: "x".repeat(81) })).toEqual({
      valid: false,
      message: "Keep work or study within 80 characters.",
    });
  });
  it("patches only fields owned by the selected editor", () => {
    const form = profileToEditForm(profile);
    const details = profileExtrasUpdate(form, false);
    expect(details).not.toHaveProperty("bio");
    expect(details).not.toHaveProperty("headline");
    expect(details).not.toHaveProperty("shareSensitiveCompatibility");
    expect(details).not.toHaveProperty("promptResponses");
    expect(details.languages).toEqual(["Telugu", "English"]);
    const prompts = profileExtrasUpdate(form, true);
    expect(Object.keys(prompts)).toEqual(["promptResponses"]);
    expect(prompts.promptResponses).toEqual([{ promptId: "ideal_sunday", answer: "A long walk" }]);
  });
  it("hydrates optional profile values without inventing defaults", () => {
    const form = profileToEditForm(profile);
    expect(form.relocationOpenness).toBe("");
    expect(form.relationshipPace).toBe("SLOW_AND_STEADY");
    expect(form.promptResponses.ideal_sunday).toBe("A long walk");
  });

  it("normalizes comma lists and removes case-insensitive duplicates", () => {
    const request = editFormToProfileUpdate({
      ...profileToEditForm(profile),
      languages: " Telugu, English, telugu,  Hindi ",
    });
    expect(request.languages).toEqual(["Telugu", "English", "Hindi"]);
    expect(request.headline).toBe("Hello");
  });

  it("uses normalized values for dirty comparison", () => {
    const form = profileToEditForm(profile);
    expect(profileEditSignature({ ...form, headline: "Hello" })).toBe(profileEditSignature(form));
  });

  it("enforces the product bio minimum before making a request", () => {
    const form = { ...profileToEditForm(profile), bio: "Too short" };
    expect(validateProfileEditForm(form)).toEqual({
      valid: false,
      message: "Write at least 20 characters in your bio.",
    });
  });

  it("matches backend limits for lists, optional values, and prompt answers", () => {
    const form = profileToEditForm(profile);
    expect(
      validateProfileEditForm({
        ...form,
        languages: Array.from({ length: 11 }, (_, index) => `Language ${index}`).join(", "),
      }),
    ).toEqual({ valid: false, message: "Add no more than 10 languages." });
    expect(validateProfileEditForm({ ...form, familyComfort: "x".repeat(121) })).toEqual({
      valid: false,
      message: "Keep family involvement comfort within 120 characters.",
    });
    expect(
      validateProfileEditForm({
        ...form,
        promptResponses: { ideal_sunday: "x".repeat(501) },
      }),
    ).toEqual({
      valid: false,
      message: "Keep each dating prompt within 500 characters.",
    });
  });

  it("reorders photos without mutating the source list", () => {
    const photos = [
      { id: "one", position: 0 },
      { id: "two", position: 1 },
    ] as MyProfileDto["photos"];
    const moved = moveProfilePhoto(photos, "two", -1);
    expect(moved.map((photo) => photo.id)).toEqual(["two", "one"]);
    expect(moved.map((photo) => photo.position)).toEqual([0, 1]);
    expect(photos.map((photo) => photo.id)).toEqual(["one", "two"]);
    expect(moveProfilePhoto(photos, "one", -1)).toBe(photos);
  });
});
