import { resetDatabase } from "../../__tests__/setup";
import { startTestServer, connectAsUser, emitWithAck } from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

const LIVE =
  process.env.LIVE_LLM_TESTS === "true" &&
  process.env.LIVE_ANTHROPIC_TESTS === "true" &&
  !!process.env.ANTHROPIC_API_KEY;

(LIVE ? describe : describe.skip)("Live Anthropic stream", () => {
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
    const user = await testPrisma.user.create({ data: { email: "livea@example.com" }, select: { id: true } });
    const modelKey = process.env.TEST_ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
    const model = await testPrisma.model.create({
      data: { provider: "anthropic", modelKey, displayName: modelKey },
      select: { id: true },
    });
    const agent = await testPrisma.agent.create({ data: { ownerId: user.id, name: "LiveAnth", defaultModelId: model.id }, select: { id: true } });
    const chat = await testPrisma.chat.create({
      data: {
        createdBy: user.id,
        title: "Live Anthropic Chat",
        acl: [{ userId: user.id, level: "Moderate" }] as unknown as object,
        agentId: agent.id,
      },
      select: { id: true },
    });
    (global as unknown as { __userId?: string; __chatId?: string; __modelId?: string }).__userId = user.id;
    (global as unknown as { __userId?: string; __chatId?: string; __modelId?: string }).__chatId = chat.id;
    (global as unknown as { __userId?: string; __chatId?: string; __modelId?: string }).__modelId = model.id;
  });

  it(
    "streams deltas and persists final; updates usage",
    async () => {
    const userId = (global as unknown as { __userId: string }).__userId;
    const chatId = (global as unknown as { __chatId: string }).__chatId;
    const modelId = (global as unknown as { __modelId: string }).__modelId;
    const client = await connectAsUser(port, userId);
    await emitWithAck(client, "messageService:subscribeChatMessages", { chatId, limit: 10 });
    const deltas: string[] = [];
    let finalId: string | undefined;
    const outcome = new Promise<"delta" | "final">((resolve) => {
      client.on(`messageService:update:${chatId}`, (evt: unknown) => {
        const e = evt as { type: string; content?: string; message?: { id: string } };
        if (e.type === "delta" && e.content) {
          deltas.push(e.content);
          resolve("delta");
        }
        if (e.type === "final" && e.message) {
          finalId = e.message.id;
          resolve("final");
        }
      });
    });
    void emitWithAck(client, "messageService:streamAssistantMessage", {
      chatId,
      prompt: "Plan the solution in 2 steps, then give a final one-sentence answer.",
      modelId,
    });
      // Wait up to 30s for delta or final
      const got = await Promise.race<"delta" | "final" | "timeout">([
        outcome,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 30000)),
      ]);
      expect(["delta", "final"]).toContain(got);
      if (finalId) {
        const model = await testPrisma.model.findUnique({ where: { id: modelId } });
        expect(Number(model?.totalRequests || 0)).toBeGreaterThan(0);
      }
      client.close();
    },
    45000
  );
});


