import { resetDatabase } from "../setup";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("memoryService adminSetEntryACL", () => {
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
    // Seed admin user with service-level Admin
    const admin = await testPrisma.user.create({
      data: {
        email: "svcadmin@example.com",
        username: "svcadmin",
        name: "Svc Admin",
        serviceAccess: { memoryService: "Admin" } as unknown as object,
      },
      select: { id: true },
    });
    const user = await testPrisma.user.create({
      data: { email: "owner@example.com", username: "owner", name: "Owner" },
      select: { id: true },
    });
    (global as unknown as { __adminId?: string }).__adminId = String(admin.id);
    (global as unknown as { __ownerId?: string }).__ownerId = String(user.id);
  });

  it("service Admin can set entry ACL", async () => {
    const adminId = (global as unknown as { __adminId: string }).__adminId;
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { memory: { id: string } }>(
      owner,
      "memoryService:createMemory",
      { content: "private" }
    );
    owner.close();

    const admin = await connectAsUser(port, adminId);
    const updated = await emitWithAck(admin, "memoryService:adminSetEntryACL", {
      id: created.memory.id,
      acl: [
        { userId: ownerId, level: "Admin" },
        { userId: adminId, level: "Admin" },
      ],
    });
    expect(updated).toBeDefined();
    admin.close();
  });
});
