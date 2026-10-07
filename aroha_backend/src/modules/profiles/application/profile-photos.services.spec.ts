import {
  DeleteProfilePhotoService,
  SetPrimaryPhotoService,
} from "./profile-photos.services";
import {
  PhotoEligibilityService,
  PhotoOwnershipPolicy,
} from "../domain/profiles.domain";

describe("DeleteProfilePhotoService", () => {
  it("rejects deleting another user's photo", async () => {
    const service = new DeleteProfilePhotoService(
      {
        $transaction: jest.fn(),
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      {
        findById: jest.fn().mockResolvedValue({
          id: "photo-1",
          userId: "user-2",
          deletedAt: null,
          moderationStatus: "APPROVED",
        }),
      } as any,
      new PhotoOwnershipPolicy(),
      {} as any,
      {} as any,
    );

    await expect(
      service.execute({
        userId: "user-1",
        photoId: "photo-1",
        metadata: {
          ipAddress: null,
          userAgent: null,
        },
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_PHOTO_NOT_OWNED",
    });
  });

  it("promotes only another approved photo when deleting the current primary", async () => {
    const tx = {};
    const profilePhotoRepository = {
      findById: jest.fn().mockResolvedValue({
        id: "photo-1",
        userId: "user-1",
        deletedAt: null,
        moderationStatus: "APPROVED",
        position: 0,
        isPrimary: true,
      }),
      softDelete: jest.fn().mockResolvedValue(undefined),
      shiftPositionsAfterRemoval: jest.fn().mockResolvedValue(undefined),
      findNextPrimaryCandidate: jest.fn().mockResolvedValue({
        id: "photo-3",
      }),
      setPrimary: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeleteProfilePhotoService(
      {
        $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
          callback(tx),
        ),
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      profilePhotoRepository as any,
      new PhotoOwnershipPolicy(),
      {
        recomputeAndPersist: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    await service.execute({
      userId: "user-1",
      photoId: "photo-1",
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(profilePhotoRepository.findNextPrimaryCandidate).toHaveBeenCalledWith(
      "user-1",
      tx,
    );
    expect(profilePhotoRepository.setPrimary).toHaveBeenCalledWith(tx, "photo-3");
  });
});

describe("SetPrimaryPhotoService", () => {
  it("rejects pending photos as primary candidates", async () => {
    const service = new SetPrimaryPhotoService(
      {
        $transaction: jest.fn(),
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      {
        findById: jest.fn().mockResolvedValue({
          id: "photo-1",
          userId: "user-1",
          deletedAt: null,
          purpose: "PROFILE",
          moderationStatus: "PENDING",
        }),
      } as any,
      new PhotoOwnershipPolicy(),
      new PhotoEligibilityService(),
      {} as any,
      {} as any,
      {
        buildReadObjectUrl: jest.fn(),
      } as any,
    );

    await expect(
      service.execute({
        userId: "user-1",
        photoId: "photo-1",
        metadata: {
          ipAddress: null,
          userAgent: null,
        },
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_PHOTO_PENDING_MODERATION",
    });
  });
});
