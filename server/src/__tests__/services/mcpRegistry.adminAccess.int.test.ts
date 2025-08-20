import { resetDatabase } from "../setup";
import { testPrisma } from "../../db/testDb";
import { McpRegistry } from "../../mcp/registry";
import ChatService from "../../services/chat";

describe("MCP Registry admin enforcement on admin-only tools", () => {
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

  it("regular user cannot invoke adminDelete on others via MCP; admin can", async () => {
    // Seed admin and regular
    const admin = await testPrisma.user.create({
      data: {
        email: "admintest@example.com",
        serviceAccess: { chatService: "Admin" } as unknown as object,
      },
      select: { id: true },
    });
    const user = await testPrisma.user.create({
      data: { email: "regulartest@example.com" },
      select: { id: true },
    });
    // Seed agents with tool allowlist including adminDelete
    const adminAgent = await testPrisma.agent.create({
      data: {
        ownerId: admin.id,
        name: "AdminAgent",
        tools: { enabled: ["chatService:adminDelete"] } as unknown as object,
      },
      select: { id: true },
    });
    const userAgent = await testPrisma.agent.create({
      data: {
        ownerId: user.id,
        name: "UserAgent",
        tools: { enabled: ["chatService:adminDelete"] } as unknown as object,
      },
      select: { id: true },
    });
    // Seed a chat created by a different owner (not the regular user)
    const owner = await testPrisma.user.create({
      data: { email: "owner@example.com" },
      select: { id: true },
    });
    const chat = await testPrisma.chat.create({
      data: {
        createdBy: owner.id,
        title: "DelTarget",
        acl: [{ userId: owner.id, level: "Admin" }] as unknown as object,
      },
      select: { id: true },
    });

    // Regular user tries adminDelete on others' chat -> denied
    let denied = false;
    try {
      await registry.invoke(
        "chatService:adminDelete",
        { id: chat.id },
        user.id,
        { agentId: userAgent.id }
      );
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);

    // Admin user can invoke adminDelete -> success
    const res = (await registry.invoke(
      "chatService:adminDelete",
      { id: chat.id },
      admin.id,
      { agentId: adminAgent.id }
    )) as { id: string; deleted: true } | undefined;
    expect(res?.deleted).toBe(true);
    const exists = await testPrisma.chat.findUnique({ where: { id: chat.id } });
    expect(exists).toBeNull();
  });
});
