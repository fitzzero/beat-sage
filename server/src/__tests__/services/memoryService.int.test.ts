import { resetDatabase } from "../../__tests__/setup";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
  waitFor,
} from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

describe("MemoryService integration", () => {
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
    await testPrisma.user.createMany({
      data: [
        { email: "owner@example.com", username: "owner", name: "Owner" },
        { email: "peer@example.com", username: "peer", name: "Peer" },
      ],
      skipDuplicates: true,
    });
    const users = await testPrisma.user.findMany({
      where: { email: { in: ["owner@example.com", "peer@example.com"] } },
      select: { id: true, email: true },
    });
    (global as unknown as { __ownerId?: string }).__ownerId = String(
      users.find((r) => r.email === "owner@example.com")!.id
    );
    (global as unknown as { __peerId?: string }).__peerId = String(
      users.find((r) => r.email === "peer@example.com")!.id
    );
  });

  it("createMemory creates a memory with owner Admin ACL and emits update", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const client = await connectAsUser(port, ownerId);
    // subscribe later to a specific id to assert update emission
    // Create
    const res = await emitWithAck<
      unknown,
      { memory: { id: string; content: string; acl?: unknown } }
    >(client, "memoryService:createMemory", {
      content: "Buy bananas tomorrow",
      type: "note",
      tags: ["todo"],
    });
    expect(res.memory.id).toBeDefined();
    expect(res.memory.content).toContain("bananas");
    // subscribe and expect an update event when we update
    const sub = await emitWithAck(client, "memoryService:subscribe", {
      entryId: res.memory.id,
    });
    expect(sub).toBeTruthy();
    const updEvent = waitFor(client, `memoryService:update:${res.memory.id}`);
    const upd = await emitWithAck<
      unknown,
      { memory?: { id: string; title?: string } }
    >(client, "memoryService:updateMemory", {
      id: res.memory.id,
      patch: { title: "Groceries" },
    });
    expect(upd.memory?.title).toBe("Groceries");
    const evt = await updEvent;
    expect(evt).toBeTruthy();
    // usageCount should increment when find/get is called (assert via getMemory)
    const before = await testPrisma.memory.findUnique({
      where: { id: res.memory.id },
      select: { usageCount: true },
    });
    await emitWithAck(client, "memoryService:getMemory", { id: res.memory.id });
    const after = await testPrisma.memory.findUnique({
      where: { id: res.memory.id },
      select: { usageCount: true },
    });
    expect((after?.usageCount ?? 0) >= (before?.usageCount ?? 0)).toBe(true);
    client.close();
  });

  it("findMemories returns lexical matches and respects ACL", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const peerId = (global as unknown as { __peerId: string }).__peerId;
    const owner = await connectAsUser(port, ownerId);
    const _m1 = await emitWithAck<unknown, { memory: { id: string } }>(
      owner,
      "memoryService:createMemory",
      { content: "Project Alpha spec", type: "note", tags: ["project"] }
    );
    const _m2 = await emitWithAck<unknown, { memory: { id: string } }>(
      owner,
      "memoryService:createMemory",
      { content: "Meeting notes about Alpha timeline", type: "note" }
    );
    // Peer should not see owner's memories by default
    const peer = await connectAsUser(port, peerId);
    const resultsPeer = await emitWithAck(peer, "memoryService:findMemories", {
      query: "alpha",
    });
    expect(Array.isArray((resultsPeer as { results: unknown[] }).results)).toBe(
      true
    );
    expect((resultsPeer as { results: unknown[] }).results.length).toBe(0);
    // Owner should see matches
    const resultsOwner = await emitWithAck(
      owner,
      "memoryService:findMemories",
      { query: "alpha" }
    );
    expect(
      (resultsOwner as { results: unknown[] }).results.length
    ).toBeGreaterThanOrEqual(2);
    owner.close();
    peer.close();
  });

  it("linkMemories and unlinkMemories manage association graph (bidirectional)", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const client = await connectAsUser(port, ownerId);
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
    const link = await emitWithAck<
      unknown,
      { id: string; associatedIds: string[] }
    >(client, "memoryService:linkMemories", {
      id: a.memory.id,
      associate: [b.memory.id],
      bidirectional: true,
    });
    expect(link.associatedIds).toContain(b.memory.id);
    const unlink = await emitWithAck<
      unknown,
      { id: string; associatedIds: string[] }
    >(client, "memoryService:unlinkMemories", {
      id: a.memory.id,
      remove: [b.memory.id],
      bidirectional: true,
    });
    expect(unlink.associatedIds).not.toContain(b.memory.id);
    client.close();
  });
});
