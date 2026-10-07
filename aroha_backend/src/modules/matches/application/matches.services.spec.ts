import {
  EndMatchService,
  UpdateMatchCommunicationSettingService,
} from "./matches.services";
import {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "../domain/matches.domain";
import { MATCH_EVENTS } from "../events/matches.events";

describe("Matches services", () => {
  it("updates my per-match communication settings", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new UpdateMatchCommunicationSettingService(
      prisma as any,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: "match-1",
          status: "ACTIVE",
          userLowId: "user-1",
          userHighId: "user-2",
        }),
      } as any,
      new MatchPolicyService(),
      new MatchCommunicationPolicyService(),
      {
        updateForUser: jest.fn().mockResolvedValue({
          id: "setting-1",
          matchId: "match-1",
          userId: "user-1",
          allowVoiceCalls: true,
          allowVideoCalls: false,
          muted: true,
          updatedAt: new Date("2026-04-17T10:00:00.000Z"),
        }),
      } as any,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      matchId: "match-1",
      payload: {
        allowVoiceCalls: true,
        allowVideoCalls: false,
        muted: true,
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.setting.allowVideoCalls).toBe(false);
    expect(result.setting.muted).toBe(true);
  });

  it("ends an active match and closes the conversation", async () => {
    const tx = {
      callSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      datePlan: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const matchRecord = {
      id: "match-1",
      status: "ACTIVE",
      userLowId: "user-1",
      userHighId: "user-2",
      conversation: {
        id: "conversation-1",
      },
    };
    const service = new EndMatchService(
      {
        $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
          callback(tx),
        ),
      } as any,
      {
        findByIdForUser: jest
          .fn()
          .mockResolvedValueOnce(matchRecord)
          .mockResolvedValueOnce({
            ...matchRecord,
            status: "ENDED",
            endedAt: new Date("2026-04-17T10:00:00.000Z"),
            endedReason: "UNMATCHED",
            matchedAt: new Date("2026-04-17T09:00:00.000Z"),
            updatedAt: new Date("2026-04-17T10:00:00.000Z"),
            conversation: {
              id: "conversation-1",
              lastMessagePreview: null,
              lastMessageSentAt: null,
            },
            communicationSettings: [],
            userLow: {
              id: "user-1",
              profile: {
                displayName: "User One",
                headline: null,
                bio: null,
                dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
                gender: null,
                pronouns: null,
                city: "Bengaluru",
                region: "Karnataka",
                countryCode: "IN",
                hideDistance: false,
                locationLat: { toString: () => "12.9716" },
                locationLng: { toString: () => "77.5946" },
              },
              photos: [],
              lifestyle: null,
              interests: [],
              intents: [{ intent: "FRIENDSHIP" }],
            },
            userHigh: {
              id: "user-2",
              profile: {
                displayName: "User Two",
                headline: null,
                bio: null,
                dateOfBirth: new Date("1991-01-01T00:00:00.000Z"),
                gender: null,
                pronouns: null,
                city: "Bengaluru",
                region: "Karnataka",
                countryCode: "IN",
                hideDistance: false,
                locationLat: { toString: () => "12.9800" },
                locationLng: { toString: () => "77.6000" },
              },
              photos: [],
              lifestyle: null,
              interests: [],
              intents: [{ intent: "FRIENDSHIP" }],
            },
          }),
        end: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getRequiredMatch: jest.fn().mockResolvedValue({
          ...matchRecord,
          status: "ENDED",
          endedAt: new Date("2026-04-17T10:00:00.000Z"),
          endedReason: "UNMATCHED",
          matchedAt: new Date("2026-04-17T09:00:00.000Z"),
          updatedAt: new Date("2026-04-17T10:00:00.000Z"),
          conversation: {
            id: "conversation-1",
            lastMessagePreview: null,
            lastMessageSentAt: null,
          },
          communicationSettings: [],
          userLow: {
            id: "user-1",
            profile: {
              displayName: "User One",
              headline: null,
              bio: null,
              dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
              gender: null,
              pronouns: null,
              city: "Bengaluru",
              region: "Karnataka",
              countryCode: "IN",
              hideDistance: false,
              locationLat: { toString: () => "12.9716" },
              locationLng: { toString: () => "77.5946" },
            },
            photos: [],
            lifestyle: null,
            interests: [],
            intents: [{ intent: "FRIENDSHIP" }],
          },
          userHigh: {
            id: "user-2",
            profile: {
              displayName: "User Two",
              headline: null,
              bio: null,
              dateOfBirth: new Date("1991-01-01T00:00:00.000Z"),
              gender: null,
              pronouns: null,
              city: "Bengaluru",
              region: "Karnataka",
              countryCode: "IN",
              hideDistance: false,
              locationLat: { toString: () => "12.9800" },
              locationLng: { toString: () => "77.6000" },
            },
            photos: [],
            lifestyle: null,
            interests: [],
            intents: [{ intent: "FRIENDSHIP" }],
          },
        }),
        mapSummary: jest.fn().mockReturnValue({
          id: "match-1",
          status: "ENDED",
        }),
      } as any,
      new MatchPolicyService(),
      new MatchParticipantPolicy(),
      {
        closeForMatch: jest.fn().mockResolvedValue({
          id: "conversation-1",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      matchId: "match-1",
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.match.status).toBe("ENDED");
  });
});
