import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { WingmanService } from "./wingman.service";

const enabledFlags = {
  execute: jest.fn().mockResolvedValue({ enabled: true }),
};
const config = {
  invitationTtlHours: 48,
  tokenPepper: "wingman-test-pepper-that-is-long-enough",
  deepLinkBase: "yariva://wingman/invite",
  discoveryRadiusMeters: 15_000,
  locationMaxAgeHours: 168,
  discoveryCacheSeconds: 60,
};

function createHarness() {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    wingmanInvitation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    wingmanParty: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    wingmanPartyMember: {
      count: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (executor: typeof tx) => unknown) =>
      callback(tx),
    ),
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    block: { count: jest.fn() },
    wingmanInvitation: { findFirst: jest.fn() },
    wingmanPartyMember: { findFirst: jest.fn() },
    scene: { findFirst: jest.fn() },
  };
  const notifications = {
    execute: jest.fn().mockResolvedValue({ created: true }),
  };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const discoveryCache = { bump: jest.fn().mockResolvedValue(undefined) };
  const service = new WingmanService(
    prisma as any,
    enabledFlags as any,
    notifications as any,
    audit as any,
    discoveryCache as any,
    config,
    { publishClosed: jest.fn() } as any,
  );
  return { service, prisma, tx, notifications, audit, discoveryCache };
}

describe("WingmanService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects self invitations before reserving a party", async () => {
    const { service, prisma } = createHarness();
    prisma.user.findFirst.mockResolvedValue({ id: "user-1", profile: null });

    await expect(
      service.invite({
        userId: "user-1",
        sessionId: "session-1",
        payload: { identifier: "me@example.com" },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.WINGMAN_SELF_INVITE });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not reveal or invite an account across a block", async () => {
    const { service, prisma } = createHarness();
    prisma.user.findFirst.mockResolvedValue({ id: "user-2", profile: null });
    prisma.block.count.mockResolvedValue(1);

    await expect(
      service.invite({
        userId: "user-1",
        sessionId: "session-1",
        payload: { identifier: "blocked@example.com" },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.WINGMAN_BLOCKED });
  });

  it("stores only a token hash while returning the single-use deep link", async () => {
    const { service, prisma, tx, notifications } = createHarness();
    prisma.user.findFirst.mockResolvedValue({
      id: "user-2",
      profile: { displayName: "Maya" },
    });
    prisma.user.findUnique.mockResolvedValue({
      profile: { displayName: "Asha" },
    });
    prisma.block.count.mockResolvedValue(0);
    tx.wingmanPartyMember.count.mockResolvedValue(0);
    tx.wingmanParty.create.mockResolvedValue({ id: "party-1" });
    tx.wingmanInvitation.create.mockImplementation(async ({ data }: any) => ({
      id: "invite-1",
      ...data,
    }));
    jest.spyOn(service, "getMine").mockResolvedValue({
      state: "PENDING",
      party: null,
    });

    const response = await service.invite({
      userId: "user-1",
      sessionId: "session-1",
      payload: { identifier: "MAYA@example.com" },
    });

    const stored = tx.wingmanInvitation.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(response.deepLink).toMatch(
      /^yariva:\/\/wingman\/invite\/[A-Za-z0-9_-]+$/,
    );
    expect(response.deepLink).not.toContain(stored.tokenHash);
    expect(notifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        dedupeKey: "wingman-invite:invite-1",
        data: { route: "yariva://wingman", partyId: "party-1" },
      }),
    );
  });

  it("binds acceptance to the authenticated invitee and activates the reservation", async () => {
    const { service, prisma, tx } = createHarness();
    const invitation = {
      id: "invite-1",
      partyId: "party-1",
      inviterUserId: "user-1",
      inviteeUserId: "user-2",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.wingmanInvitation.findFirst.mockResolvedValue(invitation);
    tx.wingmanInvitation.findFirst.mockResolvedValue(invitation);
    prisma.user.findUnique.mockResolvedValue({
      profile: { displayName: "Maya" },
    });
    jest
      .spyOn(service, "getMine")
      .mockResolvedValue({ state: "ACTIVE", party: null });

    await service.accept({
      userId: "user-2",
      sessionId: "session-2",
      payload: {},
    });

    expect(prisma.wingmanInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inviteeUserId: "user-2",
          status: "PENDING",
        }),
      }),
    );
    expect(tx.wingmanPartyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
    expect(tx.wingmanParty.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("expires a stale invitation and releases both reservations", async () => {
    const { service, prisma, tx } = createHarness();
    prisma.wingmanInvitation.findFirst.mockResolvedValue({
      id: "invite-1",
      partyId: "party-1",
      inviterUserId: "user-1",
      inviteeUserId: "user-2",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 60_000),
    });
    tx.wingmanInvitation.findMany.mockResolvedValue([
      { id: "invite-1", partyId: "party-1" },
    ]);

    await expect(
      service.accept({ userId: "user-2", sessionId: "session-2", payload: {} }),
    ).rejects.toMatchObject({ code: ERROR_CODES.WINGMAN_INVITE_EXPIRED });
    expect(tx.wingmanInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "EXPIRED" } }),
    );
    expect(tx.wingmanPartyMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DISCONNECTED" }),
      }),
    );
  });

  it("requires the actor's exact active Scene version before recording consent", async () => {
    const { service, prisma, tx } = createHarness();
    prisma.wingmanPartyMember.findFirst.mockResolvedValue({
      party: { status: "ACTIVE" },
    });
    prisma.scene.findFirst.mockResolvedValue({ id: "scene-1", version: 4 });
    jest
      .spyOn(service, "getMine")
      .mockResolvedValue({ state: "ACTIVE", party: null });

    await service.consentScene({
      userId: "user-2",
      sessionId: "session-2",
      partyId: "party-1",
      payload: { sceneId: "scene-1", sceneVersion: 4 },
    });

    expect(prisma.scene.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "scene-1",
        ownerId: "user-2",
        version: 4,
        status: "ACTIVE",
      }),
    });
    expect(tx.wingmanPartyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consentedSceneId: "scene-1",
          consentedSceneVersion: 4,
        }),
      }),
    );
  });

  it("rejects stale or unowned Scene consent", async () => {
    const { service, prisma } = createHarness();
    prisma.wingmanPartyMember.findFirst.mockResolvedValue({
      party: { status: "ACTIVE" },
    });
    prisma.scene.findFirst.mockResolvedValue(null);

    await expect(
      service.consentScene({
        userId: "user-2",
        sessionId: "session-2",
        partyId: "party-1",
        payload: { sceneId: "scene-1", sceneVersion: 3 },
      }),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      service.consentScene({
        userId: "user-2",
        sessionId: "session-2",
        partyId: "party-1",
        payload: { sceneId: "scene-1", sceneVersion: 3 },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.WINGMAN_SCENE_INVALID });
  });
});
