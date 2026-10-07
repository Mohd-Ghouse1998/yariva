import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationPageDto, MessagePageDto } from "../types/conversation";

const persistedStorage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => persistedStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      persistedStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      persistedStorage.delete(key);
    }),
  },
}));

const conversationId = "bbbb3333-3333-3333-3333-333333333333";

type FixtureRouter = typeof import("./fixtureRouter");
let fixtureRouter: FixtureRouter;

beforeEach(async () => {
  vi.resetModules();
  fixtureRouter = await import("./fixtureRouter");
  await fixtureRouter.resetFixtureDemoState();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fixture configuration guard", () => {
  it("never enables fixtures in a production build", () => {
    vi.stubEnv("EXPO_PUBLIC_USE_FIXTURES", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(fixtureRouter.isFixturesEnabled()).toBe(false);
  });

  it("enables fixtures for an explicitly marked internal demo build", () => {
    vi.stubEnv("EXPO_PUBLIC_USE_FIXTURES", "1");
    vi.stubEnv("EXPO_PUBLIC_DEMO_MODE", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(fixtureRouter.isFixturesEnabled()).toBe(true);
  });
});

describe("persistent fixture messaging", () => {
  it("sends once, updates the chat preview, and deduplicates a retry", async () => {
    const request = {
      method: "POST" as const,
      path: `conversations/${conversationId}/messages`,
      body: { textBody: "A fixture hello", clientMessageId: "client-persist-1" },
    };
    const first = await fixtureRouter.handleFixture<{ message: { id: string } }>(request);
    const retry = await fixtureRouter.handleFixture<{ message: { id: string } }>(request);
    const page = await fixtureRouter.handleFixture<MessagePageDto>({
      method: "GET",
      path: `conversations/${conversationId}/messages`,
    });
    const conversations = await fixtureRouter.handleFixture<ConversationPageDto>({
      method: "GET",
      path: "conversations",
    });

    expect(first.message.id).toBe(retry.message.id);
    expect(page.items.filter((item) => item.clientMessageId === "client-persist-1")).toHaveLength(1);
    expect(conversations.items.find((item) => item.id === conversationId)?.lastMessagePreview)
      .toBe("A fixture hello");
  });

  it("rehydrates sent messages after a simulated runtime reload", async () => {
    await fixtureRouter.handleFixture({
      method: "POST",
      path: `conversations/${conversationId}/messages`,
      body: { textBody: "Still here after reload", clientMessageId: "client-reload-1" },
    });

    vi.resetModules();
    const reloadedRouter = await import("./fixtureRouter");
    const page = await reloadedRouter.handleFixture<MessagePageDto>({
      method: "GET",
      path: `conversations/${conversationId}/messages`,
    });

    expect(page.items.some((item) => item.textBody === "Still here after reload")).toBe(true);
  });

  it("persists read state on the active conversation", async () => {
    await fixtureRouter.handleFixture({
      method: "POST",
      path: `conversations/${conversationId}/read`,
      body: { lastReadSequence: 1 },
    });
    const conversations = await fixtureRouter.handleFixture<ConversationPageDto>({
      method: "GET",
      path: "conversations",
    });
    const conversation = conversations.items.find((item) => item.id === conversationId);
    expect(conversation?.lastReadSequence).toBe(1);
    expect(conversation?.unreadCount).toBe(0);
  });
});

describe("fixture attachments", () => {
  it("uses a local fixture upload and finalizes into the active conversation", async () => {
    const upload = await fixtureRouter.handleFixture<{ uploadUrl: string; uploadToken: string; objectKey: string; bucket: string }>({
      method: "POST",
      path: "messages/attachments/upload",
      body: { conversationId, fileName: "photo.jpg" },
    });
    expect(upload.uploadUrl.startsWith("fixture://")).toBe(true);

    const result = await fixtureRouter.handleFixture<{ message: { conversationId: string; sequence: number; clientMessageId: string | null } }>({
      method: "POST",
      path: "messages/attachments/finalize",
      body: {
        conversationId,
        clientMessageId: "fixture-image-1",
        type: "IMAGE",
        uploadToken: upload.uploadToken,
        objectKey: upload.objectKey,
        bucket: upload.bucket,
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        width: 200,
        height: 300,
        fixturePreviewUri: "data:image/jpeg;base64,AA==",
      },
    });
    const conversations = await fixtureRouter.handleFixture<ConversationPageDto>({
      method: "GET",
      path: "conversations",
    });

    expect(result.message.conversationId).toBe(conversationId);
    expect(result.message.clientMessageId).toBe("fixture-image-1");
    expect(result.message.sequence).toBe(2);
    expect(conversations.items.find((item) => item.id === conversationId)?.lastMessagePreview)
      .toBe("Photo");
  });
});
