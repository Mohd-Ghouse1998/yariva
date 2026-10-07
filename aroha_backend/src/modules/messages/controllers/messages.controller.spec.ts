import { MessagesController } from "./messages.controller";

describe("MessagesController", () => {
  it("passes request metadata through on send/edit/delete flows", async () => {
    const services = {
      initiateMessageAttachmentUploadService: { execute: jest.fn() },
      sendMessageService: { execute: jest.fn().mockResolvedValue({ message: { id: "message-1" } }) },
      finalizeAttachmentMessageService: { execute: jest.fn().mockResolvedValue({ message: { id: "message-2" } }) },
      editMessageService: { execute: jest.fn().mockResolvedValue({ message: { id: "message-1" } }) },
      deleteMessageService: { execute: jest.fn().mockResolvedValue(undefined) },
    };
    const controller = new MessagesController(
      services.initiateMessageAttachmentUploadService as any,
      services.sendMessageService as any,
      services.finalizeAttachmentMessageService as any,
      services.editMessageService as any,
      services.deleteMessageService as any,
      { execute: jest.fn() } as any,
    );
    const request = {
      ip: "203.0.113.9",
      get: jest.fn().mockReturnValue("aroha-tests/1.0"),
    } as any;

    await controller.sendTextMessage(
      { id: "user-1" } as any,
      "conversation-1",
      {
        clientMessageId: "client-1",
        textBody: "hello",
        replyToMessageId: null,
      },
      request,
    );
    await controller.editMessage(
      { id: "user-1" } as any,
      "message-1",
      {
        textBody: "updated",
      },
      request,
    );
    await controller.deleteMessage(
      { id: "user-1" } as any,
      "message-1",
      request,
    );

    expect(services.sendMessageService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          ipAddress: "203.0.113.9",
          userAgent: "aroha-tests/1.0",
        },
      }),
    );
    expect(services.editMessageService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          ipAddress: "203.0.113.9",
          userAgent: "aroha-tests/1.0",
        },
      }),
    );
    expect(services.deleteMessageService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          ipAddress: "203.0.113.9",
          userAgent: "aroha-tests/1.0",
        },
      }),
    );
  });
});
