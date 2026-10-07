import { MarkConversationReadService } from "./conversations.services";
import { ConversationAccessPolicyService } from "../domain/conversations.domain";
import { CONVERSATION_EVENTS } from "../events/conversations.events";

describe("Conversations services", () => {
  it("marks a conversation read and publishes the finalized payload shape", async () => {
    const tx = {};
    const service = new MarkConversationReadService(
      {
        $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
          callback(tx),
        ),
      } as any,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: "conversation-1",
          status: "ACTIVE",
          lastMessageSequence: 8,
          match: {
            status: "ACTIVE",
            userLowId: "user-1",
            userHighId: "user-2",
          },
          reads: [
            {
              lastReadSequence: 2,
            },
          ],
        }),
      } as any,
      {
        updateReadState: jest.fn().mockResolvedValue({
          conversationId: "conversation-1",
          userId: "user-1",
          lastReadMessageId: "message-8",
          lastReadSequence: 8,
          lastReadAt: new Date("2026-04-17T10:00:00.000Z"),
        }),
      } as any,
      {
        findByConversationAndSequence: jest.fn().mockResolvedValue({
          id: "message-8",
          sequence: 8,
        }),
      } as any,
      new ConversationAccessPolicyService(),
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      conversationId: "conversation-1",
      lastReadSequence: 8,
    });

    expect(result.readState.lastReadSequence).toBe(8);
    expect((service as any).domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      CONVERSATION_EVENTS.READ_UPDATED,
      expect.objectContaining({
        conversationId: "conversation-1",
        readState: expect.objectContaining({
          userId: "user-1",
          lastReadSequence: 8,
        }),
        recipientUserIds: ["user-1", "user-2"],
      }),
    );
  });

  it("rejects read updates for closed conversations", () => {
    const policy = new ConversationAccessPolicyService();

    try {
      policy.assertCanUpdateReadState(
        {
          status: "BLOCKED",
          lastMessageSequence: 8,
        },
        {
          status: "ENDED",
        },
        {
          currentLastReadSequence: 2,
          requestedLastReadSequence: 4,
        },
      );
      throw new Error("Expected conversation policy to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONVERSATION_CLOSED",
      });
    }
  });
});
