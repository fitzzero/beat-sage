import { resetDatabase } from "../setup";
import { testPrisma } from "../../db/testDb";
import { McpRegistry } from "../../mcp/registry";
import ChatService from "../../services/chat";

describe("MCP Registry integration (chatService.updateTitle)", () => {
  let registry: McpRegistry;
  let chatService: ChatService;

  beforeAll(() => {
    registry = new McpRegistry();
    chatService = new ChatService();
    registry.registerService(
      "chatService",
      chatService as unknown as Record<string, unknown>
    );
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("agent can enable chatService.updateTitle (allowlist)", async () => {
    const admin = await testPrisma.user.create({
      data: {
        email: "admin@example.com",
        serviceAccess: { chatService: "Admin" } as unknown as object,
      },
      select: { id: true },
    });
    const agent = await testPrisma.agent.create({
      data: {
        ownerId: admin.id,
        name: "Tooly",
        tools: { enabled: ["chatService:updateTitle"] } as unknown as object,
      },
      select: { id: true, tools: true },
    });
    expect(
      Array.isArray(
        (agent.tools as unknown as { enabled?: unknown[] })?.enabled || []
      )
    ).toBe(true);
  });

  it("admin can update any chat title via MCP (inherits Admin)", async () => {
    const admin = await testPrisma.user.create({
      data: {
        email: "admin2@example.com",
        serviceAccess: { chatService: "Admin" } as unknown as object,
      },
      select: { id: true },
    });
    const other = await testPrisma.user.create({
      data: { email: "other@example.com" },
      select: { id: true },
    });
    const agent = await testPrisma.agent.create({
      data: {
        ownerId: admin.id,
        name: "Tooly2",
        tools: { enabled: ["chatService:updateTitle"] } as unknown as object,
      },
      select: { id: true },
    });
    const chat = await testPrisma.chat.create({
      data: {
        createdBy: other.id,
        title: "Original",
        acl: [{ userId: other.id, level: "Admin" }] as unknown as object,
      },
      select: { id: true, title: true },
    });
    const res = (await registry.invoke(
      "chatService:updateTitle",
      { id: chat.id, title: "Admin Update" },
      admin.id,
      { agentId: agent.id }
    )) as { id: string; title: string } | undefined;
    expect(res?.title).toBe("Admin Update");
    const row = await testPrisma.chat.findUnique({
      where: { id: chat.id },
      select: { title: true },
    });
    expect(row?.title).toBe("Admin Update");
  });

  it("normal user can only update their own chat title via MCP; fails on others", async () => {
    const user = await testPrisma.user.create({
      data: { email: "user@example.com" },
      select: { id: true },
    });
    const other = await testPrisma.user.create({
      data: { email: "other2@example.com" },
      select: { id: true },
    });
    const agent = await testPrisma.agent.create({
      data: {
        ownerId: user.id,
        name: "Tooly3",
        tools: { enabled: ["chatService:updateTitle"] } as unknown as object,
      },
      select: { id: true },
    });
    const myChat = await testPrisma.chat.create({
      data: {
        createdBy: user.id,
        title: "Mine",
        acl: [{ userId: user.id, level: "Admin" }] as unknown as object,
      },
      select: { id: true },
    });
    const othersChat = await testPrisma.chat.create({
      data: {
        createdBy: other.id,
        title: "Theirs",
        acl: [{ userId: other.id, level: "Admin" }] as unknown as object,
      },
      select: { id: true, title: true },
    });

    // Allowed: own chat
    const ok = (await registry.invoke(
      "chatService:updateTitle",
      { id: myChat.id, title: "Mine Updated" },
      user.id,
      { agentId: agent.id }
    )) as { id: string; title: string } | undefined;
    expect(ok?.title).toBe("Mine Updated");

    // Denied: others' chat
    let failed = false;
    try {
      await registry.invoke(
        "chatService:updateTitle",
        { id: othersChat.id, title: "Not Allowed" },
        user.id,
        { agentId: agent.id }
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    const row = await testPrisma.chat.findUnique({
      where: { id: othersChat.id },
      select: { title: true },
    });
    expect(row?.title).toBe("Theirs");
  });
});
