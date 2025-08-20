import { resetDatabase } from "../setup";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("memoryService association expansion", () => {
  let stop: (() => Promise<void>) | undefined;
  let port = 0;

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
    await testPrisma.user.create({
      data: { email: "owner@example.com", username: "owner", name: "Owner" },
    });
    const user = await testPrisma.user.findUnique({
      where: { email: "owner@example.com" },
      select: { id: true },
    });
    (global as unknown as { __ownerId?: string }).__ownerId = String(user!.id);
  });

  it("returns nested related trees up to depth", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const client = await connectAsUser(port, ownerId);

    // Create A, B, C and link A->B->C
    const a = await emitWithAck<unknown, { memory: { id: string } }>(
      client,
      "memoryService:createMemory",
      { content: "A" }
    );
    const b = await emitWithAck<unknown, { memory: { id: string } }>(
      client,
      "memoryService:createMemory",
      { content: "B" }
    );
    const c = await emitWithAck<unknown, { memory: { id: string } }>(
      client,
      "memoryService:createMemory",
      { content: "C" }
    );
    await emitWithAck(client, "memoryService:linkMemories", {
      id: a.memory.id,
      associate: [b.memory.id],
    });
    await emitWithAck(client, "memoryService:linkMemories", {
      id: b.memory.id,
      associate: [c.memory.id],
    });

    // getMemory depth=2 should include B as related, and B.related includes C
    const got = await emitWithAck(client, "memoryService:getMemory", {
      id: a.memory.id,
      includeAssociationsDepth: 2,
    });
    const mem = (got as { memory: Record<string, unknown> }).memory;
    expect(mem).toBeDefined();
    const related = (mem["related"] || []) as Array<Record<string, unknown>>;
    expect(related.length).toBe(1);
    const bNode = related[0] as { content: string; related?: unknown[] };
    expect(bNode.content).toBe("B");
    const bChildren = (bNode.related || []) as Array<Record<string, unknown>>;
    expect(bChildren.length).toBe(1);
    expect((bChildren[0] as { content: string }).content).toBe("C");

    // findMemories depth=1 should return A with B attached, but not C
    const list = await emitWithAck(client, "memoryService:findMemories", {
      query: "A",
      includeAssociationsDepth: 1,
    });
    const first =
      ((list as { results: Array<Record<string, unknown>> }).results ||
        [])[0] || {};
    const listRelated = (first["related"] || []) as Array<
      Record<string, unknown>
    >;
    expect(listRelated.length).toBe(1);
    const listBNode = listRelated[0] as {
      content: string;
      related?: unknown[];
    };
    expect(listBNode.content).toBe("B");
    const listBChildren = (listBNode.related || []) as Array<
      Record<string, unknown>
    >;
    expect(listBChildren.length).toBe(0);

    client.close();
  });
});
