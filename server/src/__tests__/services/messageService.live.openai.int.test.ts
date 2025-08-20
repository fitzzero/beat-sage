import { resetDatabase } from "../../__tests__/setup";
import { startTestServer, connectAsUser, emitWithAck } from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

const LIVE = process.env.LIVE_LLM_TESTS === "true" && !!process.env.OPENAI_API_KEY;

(LIVE ? describe : describe.skip)("Live OpenAI stream", () => {
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
    // seed user
    const user = await testPrisma.user.create({ data: { email: "live@example.com" }, select: { id: true } });
    // seed model
    const modelKey = process.env.TEST_OPENAI_MODEL || "gpt-4o-mini";
    const model = await testPrisma.model.create({
      data: { provider: "openai", modelKey, displayName: modelKey },
      select: { id: true },
    });
    // seed agent and chat with Moderate
    const agent = await testPrisma.agent.create({ data: { ownerId: user.id, name: "LiveAI", defaultModelId: model.id }, select: { id: true } });
    const chat = await testPrisma.chat.create({
      data: {
        createdBy: user.id,
        title: "Live OpenAI Chat",
        acl: [{ userId: user.id, level: "Moderate" }] as unknown as object,
        agentId: agent.id,
      },
      select: { id: true },
    });
    (global as unknown as { __userId?: string; __chatId?: string; __modelId?: string }).__userId = user.id;
    (global as unknown as { __userId?: string; __chatId?: string; __modelId?: string }).__chatId = chat.id;
    (global as unknown as { __userId?: string; __chatId?: string; __modelId?: string }).__modelId = model.id;
  });

  it("streams deltas and persists final; updates usage", async () => {
    const userId = (global as unknown as { __userId: string }).__userId;
    const chatId = (global as unknown as { __chatId: string }).__chatId;
    const modelId = (global as unknown as { __modelId: string }).__modelId;
    const client = await connectAsUser(port, userId);
    await emitWithAck(client, "messageService:subscribeChatMessages", { chatId, limit: 10 });
    const deltas: string[] = [];
    let finalId: string | undefined;
    const done = new Promise<void>((resolve) => {
      client.on(`messageService:update:${chatId}`, (evt: unknown) => {
        const e = evt as { type: string; content?: string; message?: { id: string } };
        if (e.type === "delta" && e.content) deltas.push(e.content);
        if (e.type === "final" && e.message) {
          finalId = e.message.id;
          resolve();
        }
      });
    });
    await emitWithAck(client, "messageService:streamAssistantMessage", {
      chatId,
      prompt: "Plan the solution in 2 steps, then give a final one-sentence answer.",
      modelId,
    });
    await done;
    expect(deltas.join("")).not.toHaveLength(0);
    expect(finalId).toBeDefined();
    // usage updated
    const model = await testPrisma.model.findUnique({ where: { id: modelId } });
    expect(Number(model?.totalRequests || 0)).toBeGreaterThan(0);
    client.close();
  });
});


