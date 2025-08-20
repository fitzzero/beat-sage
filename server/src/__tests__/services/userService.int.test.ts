import { resetDatabase } from "../../__tests__/setup";
import { seedUsers } from "../../__tests__/seed";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
  waitFor,
} from "../../__tests__/utils/socket";
import UserService from "../../services/user";

describe("UserService (integration)", () => {
  let stop: (() => Promise<void>) | undefined;
  let port: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _userService: UserService | undefined;

  beforeAll(async () => {
    const started = await startTestServer();
    port = started.port;
    stop = started.stop;
    // expose userService instance for ACL overrides in tests
    _userService = started.userService;
  });

  afterAll(async () => {
    if (stop) await stop();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("admin can update any user", async () => {
    const { adminId, regularBId } = await seedUsers();

    const adminClient = await connectAsUser(port, adminId);

    const updated = await emitWithAck(adminClient, "userService:updateUser", {
      id: regularBId,
      data: { name: "Updated By Admin" },
    });

    // With DB-backed serviceAccess, admin can update any user
    expect(updated).toBeDefined();

    adminClient.close();
  });

  it("moderate can update another user (service-level Moderate)", async () => {
    const { moderateId, regularBId } = await seedUsers();
    const client = await connectAsUser(port, moderateId);
    const updated = await emitWithAck(client, "userService:updateUser", {
      id: regularBId,
      data: { name: "Attempt By Moderate" },
    });
    expect(updated).toBeDefined();
    client.close();
  });

  it("regular user can update themselves and receive subscription updates", async () => {
    const { regularAId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);

    // Subscribe to self
    await new Promise<void>((resolve) => {
      client.emit("userService:subscribe", { entryId: regularAId }, () =>
        resolve()
      );
    });

    const updateEvent = `userService:update:${regularAId}`;
    const updatePromise = waitFor(client, updateEvent);

    // Update self
    const updated = await emitWithAck(client, "userService:updateUser", {
      id: regularAId,
      data: { name: "Self Updated" },
    });

    // For ack wrapper we return response.data; should be defined on success
    expect(updated).toBeDefined();
    const pushed = await updatePromise;
    expect((pushed as { id: string; name?: string }).id).toBe(regularAId);

    client.close();
  });

  it("regular user cannot update another user", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);
    const result = await emitWithAck(client, "userService:updateUser", {
      id: regularBId,
      data: { name: "Hacker" },
    });
    expect(result).toBeUndefined();
    client.close();
  });

  it("regular user invalid update fields rejected", async () => {
    const { regularAId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);
    // Emit and capture error via ack wrapper: it returns undefined on failure by design
    const result = await emitWithAck(client, "userService:updateUser", {
      id: regularAId,
      data: { name: "ok", emailVerified: new Date() },
    });
    expect(result).toBeUndefined();
    client.close();
  });

  it("admin and moderator can update any user when service-level ACLs are present", async () => {
    const { adminId, moderateId, regularBId } = await seedUsers();

    // Grant service-level ACLs for this test
    // defaultACL override no longer needed because service_access is persisted and cached on socket

    // Moderator can update
    const modClient = await connectAsUser(port, moderateId);
    const modUpdate = await emitWithAck(modClient, "userService:updateUser", {
      id: regularBId,
      data: { name: "Updated By Moderator" },
    });
    expect(modUpdate).toBeDefined();
    modClient.close();

    // Admin can update
    const adminClient = await connectAsUser(port, adminId);
    const adminUpdate = await emitWithAck(
      adminClient,
      "userService:updateUser",
      {
        id: regularBId,
        data: { name: "Updated By Admin" },
      }
    );
    expect(adminUpdate).toBeDefined();
    adminClient.close();
  });
});
