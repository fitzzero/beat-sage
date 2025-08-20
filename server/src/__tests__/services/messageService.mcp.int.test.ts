import { resetDatabase } from "../setup";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("MessageService orchestrator triggers MCP tool call", () => {
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

  it("emits tool start/result events and updates chat title when model outputs [TOOL] directive", async () => {
    // Seed user, model (synthetic default), agent with enabled tool, and chat
    const user = await testPrisma.user.create({
      data: {
        email: "mcpuser@example.com",
        serviceAccess: { chatService: "Moderate" } as unknown as object,
      },
      select: { id: true },
    });
    const agent = await testPrisma.agent.create({
      data: {
        ownerId: user.id,
        name: "ToolAgent",
        tools: { enabled: ["chatService:updateTitle"] } as unknown as object,
      },
      select: { id: true },
    });
    const chat = await testPrisma.chat.create({
      data: {
        createdBy: user.id,
        title: "OldTitle",
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

    // Listen for tool events
    type ToolEvt =
      | { type: "tool"; phase: "start"; toolName: string; payload: unknown }
      | { type: "tool"; phase: "result"; toolName: string; result: unknown };
    const events: ToolEvt[] = [];
    const toolPromise = new Promise<void>((resolve) => {
      client.on(`messageService:update:${chat.id}`, (evt: unknown) => {
        const e = evt as ToolEvt | { type: string };
        if (e.type === "tool") {
          events.push(e as ToolEvt);
          if (events.some((x) => x.type === "tool" && x.phase === "result")) {
            resolve();
          }
        }
      });
    });

    // The Synthetic provider simply echos the prompt. Include a [TOOL] directive
    const newTitle = "UpdatedByMCP";
    await emitWithAck(client, "messageService:streamAssistantMessage", {
      chatId: chat.id,
      agentId: agent.id,
      prompt: `[TOOL] chatService:updateTitle {"id":"${chat.id}","title":"${newTitle}"}`,
    });

    await toolPromise;
    expect(
      events.find((e) => e.type === "tool" && e.phase === "start")
    ).toBeTruthy();
    expect(
      events.find(
        (e) =>
          e.type === "tool" &&
          e.phase === "result" &&
          e.toolName === "chatService:updateTitle"
      )
    ).toBeTruthy();

    const row = await testPrisma.chat.findUnique({
      where: { id: chat.id },
      select: { title: true },
    });
    expect(row?.title).toBe(newTitle);
    client.close();
  }, 20000);
});
