import { resetDatabase } from "../../__tests__/setup";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
} from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

describe("ModelService integration", () => {
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
    // seed one user with modelService Moderate
    const user = await testPrisma.user.create({
      data: {
        email: "mod@example.com",
        username: "mod",
        name: "Moderator",
        serviceAccess: { modelService: "Moderate" } as unknown as object,
      },
      select: { id: true },
    });
    const modId = user.id;
    // seed a model
    await testPrisma.model.create({
      data: {
        provider: "openai",
        modelKey: "gpt-5",
        displayName: "GPT-5",
        contextWindowTokens: 200000,
        isActive: true,
      },
    });
    (global as unknown as { __modId?: string }).__modId = modId;
  });

  it("listActive returns active models", async () => {
    const modId = (global as unknown as { __modId: string }).__modId;
    const client = await connectAsUser(port, modId);
    const res = await emitWithAck<{ provider?: string }, unknown[]>(
      client,
      "modelService:listActive",
      {}
    );
    expect(Array.isArray(res)).toBe(true);
    client.close();
  });

  it("recordUsage increments counters", async () => {
    const modId = (global as unknown as { __modId: string }).__modId;
    const client = await connectAsUser(port, modId);
    const row = await testPrisma.model.findFirst({ select: { id: true } });
    if (!row) throw new Error("Model not seeded");
    const modelId = row.id;
    const res = await emitWithAck<
      { id: string; inputTokens: number; outputTokens: number },
      { totalInputTokens: number }
    >(client, "modelService:recordUsage", {
      id: modelId,
      inputTokens: 123,
      outputTokens: 456,
    });
    expect(
      (res as { totalInputTokens: number }).totalInputTokens
    ).toBeGreaterThanOrEqual(123);
    client.close();
  });
});
