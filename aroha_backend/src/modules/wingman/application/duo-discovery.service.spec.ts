import {
  hasCompatibleCompletePairing,
  maxCrossDistanceMeters,
  partyIsReady,
  voteIsCurrent,
} from "./duo-discovery.service";

const now = new Date("2026-09-23T12:00:00.000Z");

function member(input: {
  id: string;
  role: "OWNER" | "BUDDY";
  intent?: "DATING" | "FRIENDSHIP" | "CASUAL_HANG";
  gender?: "MAN" | "WOMAN";
  preferredGenders?: Array<"MAN" | "WOMAN">;
  lat?: number;
  lng?: number;
}) {
  const sceneId = `scene-${input.id}`;
  return {
    id: `member-${input.id}`,
    partyId: "unused",
    userId: input.id,
    role: input.role,
    status: "ACTIVE",
    consentedSceneId: sceneId,
    consentedSceneVersion: 3,
    sceneConsentedAt: now,
    joinedAt: now,
    disconnectedAt: null,
    createdAt: now,
    updatedAt: now,
    consentedScene: {
      id: sceneId,
      userId: input.id,
      version: 3,
      intent: input.intent ?? "FRIENDSHIP",
      activity: "Coffee nearby",
      status: "ACTIVE",
      expiresAt: new Date("2026-09-24T12:00:00.000Z"),
      photo: null,
    },
    user: {
      id: input.id,
      status: "ACTIVE",
      deletedAt: null,
      isShadowBanned: false,
      isDiscoveryFrozen: false,
      profile: {
        userId: input.id,
        displayName: input.id,
        gender: input.gender ?? "MAN",
        dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
        isComplete: true,
        isHidden: false,
        isIncognito: false,
        isPaused: false,
        deletedAt: null,
        locationLat: input.lat ?? 17.4,
        locationLng: input.lng ?? 78.48,
        locationUpdatedAt: now,
      },
      discoveryPreference: {
        minAge: 18,
        maxAge: 40,
        preferredGenders: input.preferredGenders ?? [],
      },
      photos: [],
    },
  };
}

function party(id: string, members: ReturnType<typeof member>[]) {
  return {
    id,
    status: "ACTIVE",
    membershipVersion: 2,
    members,
    createdAt: now,
    updatedAt: now,
  } as any;
}

describe("Duo discovery domain rules", () => {
  it("requires both active members to consent to the exact current Scene version", () => {
    const ready = party("party-a", [
      member({ id: "a", role: "OWNER" }),
      member({ id: "b", role: "BUDDY" }),
    ]);

    expect(partyIsReady(ready, now, 168)).toBe(true);
    ready.members[1].consentedSceneVersion = 2;
    expect(partyIsReady(ready, now, 168)).toBe(false);
  });

  it("invalidates a private vote when either membership or Scene snapshot changes", () => {
    const source = party("party-a", [
      member({ id: "a", role: "OWNER" }),
      member({ id: "b", role: "BUDDY" }),
    ]);
    const target = party("party-b", [
      member({ id: "x", role: "OWNER" }),
      member({ id: "y", role: "BUDDY" }),
    ]);
    const vote = {
      voterUserId: "a",
      sourceMembershipVersion: 2,
      targetMembershipVersion: 2,
      sourceSceneId: "scene-a",
      sourceSceneVersion: 3,
      targetOwnerSceneId: "scene-x",
      targetOwnerSceneVersion: 3,
      targetBuddySceneId: "scene-y",
      targetBuddySceneVersion: 3,
    };

    expect(voteIsCurrent(vote, source, target)).toBe(true);
    target.members[1].consentedScene!.version = 4;
    expect(voteIsCurrent(vote, source, target)).toBe(false);
  });

  it("accepts a complete one-to-one pairing without requiring attraction to both people", () => {
    const source = party("party-a", [
      member({
        id: "a",
        role: "OWNER",
        intent: "DATING",
        gender: "MAN",
        preferredGenders: ["WOMAN"],
      }),
      member({
        id: "b",
        role: "BUDDY",
        intent: "DATING",
        gender: "WOMAN",
        preferredGenders: ["MAN"],
      }),
    ]);
    const target = party("party-b", [
      member({
        id: "x",
        role: "OWNER",
        intent: "DATING",
        gender: "WOMAN",
        preferredGenders: ["MAN"],
      }),
      member({
        id: "y",
        role: "BUDDY",
        intent: "DATING",
        gender: "MAN",
        preferredGenders: ["WOMAN"],
      }),
    ]);

    expect(hasCompatibleCompletePairing(source, target, now)).toBe(true);
    target.members[0].user.discoveryPreference.preferredGenders = ["WOMAN"];
    expect(hasCompatibleCompletePairing(source, target, now)).toBe(false);
  });

  it("uses the farthest of all four cross-Duo distances", () => {
    const source = party("party-a", [
      member({ id: "a", role: "OWNER", lat: 17.4, lng: 78.48 }),
      member({ id: "b", role: "BUDDY", lat: 17.41, lng: 78.48 }),
    ]);
    const target = party("party-b", [
      member({ id: "x", role: "OWNER", lat: 17.42, lng: 78.48 }),
      member({ id: "y", role: "BUDDY", lat: 17.5, lng: 78.48 }),
    ]);

    const farthest = maxCrossDistanceMeters(source, target);
    expect(farthest).toBeGreaterThan(11_000);
    expect(farthest).toBeLessThan(11_200);
  });
});
