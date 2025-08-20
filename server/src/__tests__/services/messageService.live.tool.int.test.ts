import { resetDatabase } from "../setup";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

const LIVE =
  process.env.LIVE_LLM_TESTS === "true" && !!process.env.OPENAI_API_KEY;

(LIVE ? describe : describe.skip)("Live OpenAI tool invocation", () => {
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
  });

  it("gpt-4o-mini can invoke chatService:updateTitle via [TOOL] directive", async () => {
    const user = await testPrisma.user.create({
      data: {
        email: "live-tool@example.com",
        serviceAccess: { chatService: "Moderate" } as unknown as object,
      },
      select: { id: true },
    });
    const modelKey = process.env.TEST_OPENAI_MODEL || "gpt-4o-mini";
    const model = await testPrisma.model.create({
      data: { provider: "openai", modelKey, displayName: modelKey },
      select: { id: true },
    });
    const agent = await testPrisma.agent.create({
      data: {
        ownerId: user.id,
        name: "LiveToolAI",
        defaultModelId: model.id,
        tools: { enabled: ["chatService:updateTitle"] } as unknown as object,
      },
      select: { id: true },
    });
    const chat = await testPrisma.chat.create({
      data: {
        createdBy: user.id,
        title: "Before",
        acl: [{ userId: user.id, level: "Moderate" }] as unknown as object,
        agentId: agent.id,
      },
      select: { id: true },
    });

    const client = await connectAsUser(port, user.id);
    await emitWithAck(client, "messageService:subscribeChatMessages", {
      chatId: chat.id,
      limit: 10,
    });

    // Wait for tool result
    type ToolEvt = {
      type: "tool";
      phase: "start" | "result" | "error";
      toolName: string;
    };
    const toolDone = new Promise<void>((resolve) => {
      client.on(`messageService:update:${chat.id}`, (evt: unknown) => {
        const e = evt as ToolEvt | { type: string };
        if ((e as ToolEvt).type === "tool" && (e as ToolEvt).phase === "result")
          resolve();
      });
    });

    const newTitle = "LiveUpdated";
    await emitWithAck(client, "messageService:streamAssistantMessage", {
      chatId: chat.id,
      agentId: agent.id,
      modelId: model.id,
      prompt: `Please update the chat title.\n[TOOL] chatService:updateTitle {"id":"${chat.id}","title":"${newTitle}"}`,
    });

    await toolDone;
    const row = await testPrisma.chat.findUnique({
      where: { id: chat.id },
      select: { title: true },
    });
    expect(row?.title).toBe(newTitle);
    client.close();
  }, 60000);
});
