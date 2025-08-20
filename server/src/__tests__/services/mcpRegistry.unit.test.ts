import { McpRegistry } from "../../mcp/registry";
import MemoryService from "../../services/memory";
import { resetDatabase } from "../setup";
import { testPrisma } from "../../db/testDb";

describe("MCP Registry", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it("lists tools and invokes methods with user context", async () => {
    // Seed users
    await testPrisma.user.createMany({
      data: [
        { email: "mcpa@example.com", username: "mcpa", name: "MCPA" },
        { email: "mcpb@example.com", username: "mcpb", name: "MCPB" },
      ],
      skipDuplicates: true,
    });
    const users = await testPrisma.user.findMany({
      select: { id: true, email: true },
    });
    const aId = String(users.find((u) => u.email === "mcpa@example.com")!.id);

    // Registry
    const reg = new McpRegistry();
    const memoryService = new MemoryService();
    reg.registerService(
      "memoryService",
      memoryService as unknown as Record<string, unknown>
    );

    const tools = reg.listTools();
    expect(Array.isArray(tools)).toBe(true);
    // Should include createMemory
    expect(tools.some((t) => t.name === "memoryService:createMemory")).toBe(
      true
    );

    // Invoke createMemory as user A
    const result = (await reg.invoke(
      "memoryService:createMemory",
      { content: "MCP Created" },
      aId
    )) as { memory: { id: string } };
    expect(result.memory.id).toBeDefined();

    // Ensure the memory is owned by user A
    const row = await testPrisma.memory.findUnique({
      where: { id: result.memory.id },
    });
    expect(String(row?.userId)).toBe(aId);
  });
});
