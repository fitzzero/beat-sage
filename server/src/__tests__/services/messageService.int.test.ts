import { resetDatabase } from "../../__tests__/setup";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
} from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

describe("MessageService integration", () => {
  let stop: (() => Promise<void>) | undefined;
  let port: number;

  beforeAll(async () => {
    const started = await startTestServer();
    port = started.port;
    stop = started.stop;
  });

  afterAll(async () => {
    if (stop) await stop();
  });

  beforeEach(async () => {
    await resetDatabase();
    await testPrisma.user.createMany({
      data: [
        { email: "owner@example.com", username: "owner", name: "Owner" },
        { email: "member@example.com", username: "mem", name: "Member" },
      ],
      skipDuplicates: true,
    });
    const users = await testPrisma.user.findMany({
      where: { email: { in: ["owner@example.com", "member@example.com"] } },
      select: { id: true, email: true },
    });
    const owner = users.find((r) => r.email === "owner@example.com");
    const member = users.find((r) => r.email === "member@example.com");
    if (!owner || !member) throw new Error("Seed users missing");
    const ownerId = owner.id;
    const memberId = member.id;
    // create chat with member Read
    const acl = [
      { userId: ownerId, level: "Admin" },
      { userId: memberId, level: "Read" },
    ];
    const chatRow = await testPrisma.chat.create({
      data: {
        createdBy: ownerId,
        title: "Chat",
        acl: acl as unknown as object,
      },
      select: { id: true },
    });
    (
      global as unknown as {
        __ownerId?: string;
        __memberId?: string;
        __chatId?: string;
      }
    ).__ownerId = ownerId;
    (
      global as unknown as {
        __ownerId?: string;
        __memberId?: string;
        __chatId?: string;
      }
    ).__memberId = memberId;
    (
      global as unknown as {
        __ownerId?: string;
        __memberId?: string;
        __chatId?: string;
      }
    ).__chatId = chatRow.id;
  });

  it("member can post and list messages", async () => {
    const memberId = (global as unknown as { __memberId: string }).__memberId;
    const chatId = (global as unknown as { __chatId: string }).__chatId;
    const client = await connectAsUser(port, memberId);
    const created = await emitWithAck<
      { chatId: string; content: string },
      { id: string }
    >(client, "messageService:postMessage", { chatId, content: "hello" });
    expect((created as { id: string }).id).toBeDefined();
    const list = await emitWithAck<
      { chatId: string; limit: number },
      Array<{ id: string; role: string; content: string }>
    >(client, "messageService:listMessages", { chatId, limit: 10 });
    expect(Array.isArray(list)).toBe(true);
    client.close();
  });

  it("moderate can stream assistant message with deltas and final persistence", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const memberId = (global as unknown as { __memberId: string }).__memberId;
    const chatId = (global as unknown as { __chatId: string }).__chatId;
    // grant member moderate via ACL
    const acl = [
      { userId: ownerId, level: "Admin" },
      { userId: memberId, level: "Moderate" },
    ];
    await testPrisma.chat.update({
      where: { id: chatId },
      data: { acl: acl as unknown as object },
    });
    const mod = await connectAsUser(port, memberId);
    // We'll listen to messageService chat-scoped update events via subscribeChatMessages
    const deltas: string[] = [];
    // collect deltas and final
    type UpdateEvt =
      | { type: "delta"; content: string }
      | { type: "final"; message: { id: string; content: string } }
      | { type: "created"; id: string };
    const finalPromise = new Promise<{ id: string; content: string }>(
      (resolve) => {
        mod.on(`messageService:update:${chatId}`, (evt: UpdateEvt) => {
          if (evt.type === "delta") deltas.push(evt.content);
          if (evt.type === "final") {
            resolve({ id: evt.message.id, content: evt.message.content });
          }
        });
      }
    );
    // subscribe to message updates for chat via messageService method
    await emitWithAck<{ chatId: string; limit: number }>(
      mod,
      "messageService:subscribeChatMessages",
      {
        chatId,
        limit: 10,
      }
    );
    const ack = await emitWithAck<
      { chatId: string; prompt: string },
      { id: string }
    >(mod, "messageService:streamAssistantMessage", { chatId, prompt: "Hi" });
    expect(ack && (ack as { id: string }).id).toBeDefined();
    const fin = await finalPromise;
    expect(fin.id).toBe(ack.id);
    // With the orchestrator, streamed content may vary by provider.
    // Assert we received some deltas and a non-empty final content.
    expect(deltas.join("")).not.toHaveLength(0);
    expect(fin.content).not.toHaveLength(0);
    // Validator ensures final ends with sentence punctuation
    expect(/[.!?]$/.test(fin.content.trim())).toBe(true);
    mod.close();
  });

  it("denies stream for Read and allows after upgrading to Moderate", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const memberId = (global as unknown as { __memberId: string }).__memberId;
    const chatId = (global as unknown as { __chatId: string }).__chatId;
    // leave as Read (seeded)
    const client = await connectAsUser(port, memberId);
    // Expect failure ack; our emitWithAck returns only data, so we check lack of id via guard
    const ack = await emitWithAck<
      { chatId: string; prompt: string },
      { id?: string } | undefined
    >(client, "messageService:streamAssistantMessage", {
      chatId,
      prompt: "try",
    });
    expect(ack).toBeUndefined();
    client.close();

    // Upgrade to Moderate
    const acl = [
      { userId: ownerId, level: "Admin" },
      { userId: memberId, level: "Moderate" },
    ];
    await testPrisma.chat.update({
      where: { id: chatId },
      data: { acl: acl as unknown as object },
    });
    const mod = await connectAsUser(port, memberId);
    const ack2 = await emitWithAck<
      { chatId: string; prompt: string },
      { id: string }
    >(mod, "messageService:streamAssistantMessage", {
      chatId,
      prompt: "now works",
    });
    expect(ack2 && (ack2 as { id: string }).id).toBeDefined();
    mod.close();
  });

  it("supports cancellation mid-stream and does not persist final", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const memberId = (global as unknown as { __memberId: string }).__memberId;
    const chatId = (global as unknown as { __chatId: string }).__chatId;
    // grant Moderate
    const acl = [
      { userId: ownerId, level: "Admin" },
      { userId: memberId, level: "Moderate" },
    ];
    await testPrisma.chat.update({
      where: { id: chatId },
      data: { acl: acl as unknown as object },
    });
    const mod = await connectAsUser(port, memberId);
    await emitWithAck<{ chatId: string; limit: number }>(
      mod,
      "messageService:subscribeChatMessages",
      {
        chatId,
        limit: 10,
      }
    );

    // Start stream
    void emitWithAck<{ chatId: string; prompt: string }, { id: string }>(
      mod,
      "messageService:streamAssistantMessage",
      {
        chatId,
        prompt:
          "Generate a long, multi-part answer with many details so I can cancel.",
      }
    );

    // Wait for first delta then cancel
    await new Promise<void>((resolve) => {
      mod.once(`messageService:update:${chatId}`, () => resolve());
    });
    await emitWithAck<{ chatId: string }, { cancelled: boolean }>(
      mod,
      "messageService:cancelStream",
      {
        chatId,
      }
    );

    // Slight delay and then ensure no new assistant message persisted
    await new Promise((r) => setTimeout(r, 50));
    const rows = await testPrisma.message.findMany({ where: { chatId } });
    const hasAssistant = rows.some((r) => r.role === "assistant");
    expect(hasAssistant).toBe(false);
    mod.close();
  });
});
