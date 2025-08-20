import { resetDatabase } from "../setup";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
  waitFor,
} from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("memoryService subscribe/update events", () => {
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

  it("subscriber receives update event on updateMemory", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const client = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { memory: { id: string } }>(
      client,
      "memoryService:createMemory",
      { content: "initial" }
    );
    // subscribe
    const subAck = await emitWithAck(client, "memoryService:subscribe", {
      entryId: created.memory.id,
    });
    expect(subAck).toBeTruthy();
    const evtP = waitFor(client, `memoryService:update:${created.memory.id}`);
    // update
    await emitWithAck(client, "memoryService:updateMemory", {
      id: created.memory.id,
      patch: { content: "changed" },
    });
    const evt = await evtP;
    expect(evt).toBeTruthy();
    client.close();
  });
});
