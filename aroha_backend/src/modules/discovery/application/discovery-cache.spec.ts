import type { ConfigType } from "@nestjs/config";
import { Prisma } from "../../../generated/prisma/client";
import authConfig from "../../../config/auth.config";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { GetDiscoveryFeedService } from "./discovery.services";
import {
  CandidateEligibilityService, DiscoveryAccessPolicy, DiscoveryDiversityService,
  DiscoveryPayloadMapperService, DiscoveryRankingService,
} from "../domain/discovery.domain";
import {
  CandidateDiscoveryRecord, DiscoveryQueryRepository, DiscoverySnapshotRepository,
  ViewerDiscoveryContext,
} from "../infrastructure/discovery.infrastructure";

describe("cached discovery authorization", () => {
  function setup() {
    const viewer = {
      id: "viewer", status: "ACTIVE", deletedAt: null,
      profile: {
        isComplete: true, dateOfBirth: new Date("1994-01-01"), gender: "MAN",
        locationLat: 17.385, locationLng: 78.4867,
      },
      discoveryPreference: { minAge: 18, maxAge: 99, maxDistanceKm: 50, intentFilter: [], preferredGenders: [] },
      intents: [{ intent: "DATING" }], interests: [],
    } as unknown as ViewerDiscoveryContext;
    const candidates = ["first", "second", "third", "fourth"].map((id) => ({
      id, status: "ACTIVE", deletedAt: null,
      profile: { ...viewer.profile, displayName: id },
      discoveryPreference: { ...viewer.discoveryPreference },
      photos: [], intents: [{ intent: "DATING" }], interests: [],
    })) as unknown as CandidateDiscoveryRecord[];
    const exclusions = {
      blockedUserIds: new Set<string>(), matchedUserIds: new Set<string>(),
      activePassUserIds: new Set<string>(), activeLikeUserIds: new Set<string>(),
    };
    const query = {
      findViewerContext: jest.fn(async () => viewer),
      findCandidatesByIds: jest.fn(async (ids: string[]) => candidates.filter(c => ids.includes(c.id))),
      loadExclusionState: jest.fn(async () => exclusions),
    };
    const snapshots = {
      get: jest.fn(async () => ({
        snapshotId: "snapshot", viewerId: viewer.id, preferenceHash: "hash",
        candidateIds: candidates.map(c => c.id), createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      })),
      markRecentlyServed: jest.fn(),
    };
    const storage = { createPresignedGetObject: jest.fn() };
    const service = new GetDiscoveryFeedService(
      query as unknown as DiscoveryQueryRepository,
      snapshots as unknown as DiscoverySnapshotRepository,
      new DiscoveryAccessPolicy(), new CandidateEligibilityService(),
      new DiscoveryRankingService(), new DiscoveryDiversityService(),
      new DiscoveryPayloadMapperService(), storage as unknown as ObjectStorageService,
      { passwordPepper: "test-pepper" } as ConfigType<typeof authConfig>,
    );
    return { service, viewer, candidates, exclusions, query, snapshots };
  }

  it("rechecks fresh exclusions after caching", async () => {
    const { service, exclusions } = setup();
    expect((await service.execute({ userId: "viewer" })).items.map(i => i.userId)).toContain("first");
    // Repository loads both directions from current Block rows, not from the snapshot.
    exclusions.blockedUserIds.add("first");
    const response = await service.execute({ userId: "viewer" });
    expect(response.items.map(i => i.userId)).not.toContain("first");
  });

  it("fills a page from later eligible IDs and advances past removed candidates without duplicates", async () => {
    const { service, exclusions, snapshots } = setup();
    exclusions.blockedUserIds.add("first");
    const first = await service.execute({ userId: "viewer", limit: 1 });
    expect(first.items.map(i => i.userId)).toEqual(["second"]);
    expect(first.nextCursor).toEqual(expect.any(String));
    exclusions.activeLikeUserIds.add("third");
    const next = await service.execute({ userId: "viewer", limit: 1, cursor: first.nextCursor! });
    expect(next.items.map(i => i.userId)).toEqual(["fourth"]);
    expect(next.nextCursor).toBeNull();
    expect(next.remainingToday).toBe(0);
    expect(snapshots.markRecentlyServed).toHaveBeenLastCalledWith("viewer", ["fourth"]);
  });

  it("rechecks current mutual age, gender, intent and distance preferences", async () => {
    const { service, candidates, viewer } = setup();
    candidates[0]!.discoveryPreference!.preferredGenders = ["WOMAN"];
    candidates[1]!.discoveryPreference!.minAge = 90;
    candidates[2]!.intents = [{ intent: "FRIENDSHIP" }];
    viewer.discoveryPreference!.maxDistanceKm = 1;
    candidates[3]!.profile.locationLat = new Prisma.Decimal(50);
    const response = await service.execute({ userId: "viewer" });
    expect(response.items).toEqual([]);
    expect(response.nextCursor).toBeNull();
    expect(response.remainingToday).toBe(0);
  });
  it("rechecks work sharing consent for cached category matches", async () => {
    const { service, viewer, candidates } = setup();
    viewer.discoveryPreference!.occupationCategoryFilter = ["TECHNOLOGY"];
    candidates[0]!.profile.occupationCategory = "TECHNOLOGY";
    candidates[0]!.profile.shareWorkDetails = true;
    expect((await service.execute({ userId: "viewer" })).items.map(i => i.userId)).toEqual(["first"]);
    candidates[0]!.profile.shareWorkDetails = false;
    expect((await service.execute({ userId: "viewer" })).items).toEqual([]);
  });

});
