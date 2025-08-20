import { resetDatabase } from "../../__tests__/setup";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
} from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

describe("AgentService integration", () => {
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
    // seed users: owner and moderator
    await testPrisma.user.createMany({
      data: [
        { email: "owner@example.com", username: "owner", name: "Owner" },
        {
          email: "mod@example.com",
          username: "mod",
          name: "Moderator",
          serviceAccess: { agentService: "Moderate" } as unknown as object,
        },
      ],
      skipDuplicates: true,
    });
    const users = await testPrisma.user.findMany({
      where: { email: { in: ["owner@example.com", "mod@example.com"] } },
      select: { id: true, email: true },
    });
    (global as unknown as { __ownerId?: string; __modId?: string }).__ownerId =
      String(users.find((r) => r.email === "owner@example.com")!.id);
    (global as unknown as { __ownerId?: string; __modId?: string }).__modId =
      String(users.find((r) => r.email === "mod@example.com")!.id);
  });

  it("owner can create and update own agent", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const client = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      client,
      "agentService:createAgent",
      {
        name: "Zero",
        description: "Test agent",
      }
    );
    expect(created.id).toBeDefined();
    const updated = await emitWithAck<unknown, { id: string }>(
      client,
      "agentService:updateAgent",
      {
        id: created.id,
        data: { description: "Updated" },
      }
    );
    expect(updated.id).toBe(created.id);
    client.close();
  });

  it("owner can set defaultModelId on agent and it persists", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const client = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      client,
      "agentService:createAgent",
      {
        name: "Alpha",
      }
    );
    // Seed a model
    const model = await testPrisma.model.create({
      data: {
        provider: "openai",
        modelKey: "gpt-4o",
        displayName: "GPT-4o",
        contextWindowTokens: 128000,
        isActive: true,
      },
      select: { id: true },
    });
    const updated = await emitWithAck<
      { id: string; data: { defaultModelId: string } },
      { id: string }
    >(client, "agentService:updateAgent", {
      id: created.id,
      data: { defaultModelId: model.id },
    });
    expect(updated.id).toBe(created.id);
    const row = await testPrisma.agent.findUnique({
      where: { id: created.id },
      select: { defaultModelId: true },
    });
    expect(row?.defaultModelId).toBe(model.id);
    client.close();
  });

  it("moderator can update others' agents", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const modId = (global as unknown as { __modId: string }).__modId;
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "agentService:createAgent",
      {
        name: "Zero",
      }
    );
    owner.close();
    const mod = await connectAsUser(port, modId);
    const updated = await emitWithAck<unknown, { id: string }>(
      mod,
      "agentService:updateAgent",
      {
        id: created.id,
        data: { name: "X" },
      }
    );
    expect(updated.id).toBe(created.id);
    mod.close();
  });
});
