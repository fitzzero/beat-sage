import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { resetDatabase } from "../setup";
import { testPrisma } from "../../db/testDb";

describe("memoryService DTO rules", () => {
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
    await testPrisma.user.createMany({
      data: [
        { email: "owner@example.com", username: "owner", name: "Owner" },
        { email: "admin@example.com", username: "admin", name: "Admin" },
      ],
      skipDuplicates: true,
    });
    const [owner, admin] = await testPrisma.user.findMany({
      where: { email: { in: ["owner@example.com", "admin@example.com"] } },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });
    // Grant service-level Admin to second user
    await testPrisma.user.update({
      where: { id: admin.id },
      data: { serviceAccess: { memoryService: "Admin" } as unknown as object },
    });
    (global as unknown as { __ownerId?: string }).__ownerId = String(owner.id);
    (global as unknown as { __adminId?: string }).__adminId = String(admin.id);
  });

  it("non-admin callers do not see acl field in DTOs; service admins do", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const adminId = (global as unknown as { __adminId: string }).__adminId;

    // Owner creates memory (entry ACL will include Admin for owner)
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { memory: { id: string } }>(
      owner,
      "memoryService:createMemory",
      { content: "Sensitive", type: "note" }
    );
    const memId = created.memory.id;

    // Owner fetches memory (not service admin): acl should be hidden
    const gotOwner = await emitWithAck(owner, "memoryService:getMemory", {
      id: memId,
    });
    expect(
      (gotOwner as { memory: Record<string, unknown> }).memory
    ).toBeDefined();
    const ownerMem = (gotOwner as { memory: Record<string, unknown> }).memory;
    expect(ownerMem["acl"]).toBeUndefined();
    owner.close();

    // Service admin fetches memory: acl visible
    const admin = await connectAsUser(port, adminId);
    const gotAdmin = await emitWithAck(admin, "memoryService:getMemory", {
      id: memId,
    });
    expect(
      (gotAdmin as { memory: Record<string, unknown> }).memory
    ).toBeDefined();
    const adminMem = (gotAdmin as { memory: Record<string, unknown> }).memory;
    expect(adminMem["acl"]).toBeDefined();
    admin.close();
  });
});
