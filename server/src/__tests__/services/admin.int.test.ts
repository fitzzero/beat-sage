import { resetDatabase } from "../../__tests__/setup";
import { seedUsers } from "../../__tests__/seed";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
  waitFor,
} from "../../__tests__/utils/socket";

describe("UserService Admin Methods (integration)", () => {
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
  });

  it("adminList requires Moderate and returns paginated rows", async () => {
    const { moderateId } = await seedUsers();
    const client = await connectAsUser(port, moderateId);
    const res = await emitWithAck(client, "userService:adminList", {
      page: 1,
      pageSize: 10,
    });
    expect(res).toBeDefined();
    expect((res as { rows: unknown[] }).rows).toBeInstanceOf(Array);
    client.close();
  });

  it("regular user cannot adminList", async () => {
    const { regularAId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);
    const res = await emitWithAck(client, "userService:adminList", {});
    expect(res).toBeUndefined();
    client.close();
  });

  it("adminGet returns a user for Moderate", async () => {
    const { moderateId, regularAId } = await seedUsers();
    const client = await connectAsUser(port, moderateId);
    const res = await emitWithAck(client, "userService:adminGet", {
      id: regularAId,
    });
    expect(res).toBeDefined();
    expect((res as { id: string }).id).toBe(regularAId);
    client.close();
  });

  it("regular user cannot adminGet", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);
    const res = await emitWithAck(client, "userService:adminGet", {
      id: regularBId,
    });
    expect(res).toBeUndefined();
    client.close();
  });

  it("adminUpdate by Moderate emits update event", async () => {
    const { moderateId, regularAId } = await seedUsers();
    const client = await connectAsUser(port, moderateId);
    await new Promise<void>((resolve) => {
      client.emit("userService:subscribe", { entryId: regularAId }, () =>
        resolve()
      );
    });
    const updateEvent = `userService:update:${regularAId}`;
    const pushed = waitFor(client, updateEvent);

    const res = await emitWithAck(client, "userService:adminUpdate", {
      id: regularAId,
      data: { name: "Updated By Admin Method" },
    });
    expect(res).toBeDefined();
    const ev = (await pushed) as { id: string };
    expect(ev.id).toBe(regularAId);
    client.close();
  });

  it("regular user cannot adminUpdate others", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);
    const res = await emitWithAck(client, "userService:adminUpdate", {
      id: regularBId,
      data: { name: "Nope" },
    });
    expect(res).toBeUndefined();
    client.close();
  });

  it("adminSetEntryACL requires Admin and updates acl", async () => {
    const { adminId, regularAId } = await seedUsers();
    const client = await connectAsUser(port, adminId);
    const res = await emitWithAck(client, "userService:adminSetEntryACL", {
      id: regularAId,
      acl: [{ userId: adminId, level: "Admin" }],
    });
    expect(res).toBeDefined();
    client.close();
  });

  it("moderate cannot adminSetEntryACL", async () => {
    const { moderateId, regularAId } = await seedUsers();
    const client = await connectAsUser(port, moderateId);
    const res = await emitWithAck(client, "userService:adminSetEntryACL", {
      id: regularAId,
      acl: [{ userId: moderateId, level: "Moderate" }],
    });
    expect(res).toBeUndefined();
    client.close();
  });

  it("adminGetSubscribers and adminUnsubscribeAll require Admin", async () => {
    const { adminId, regularAId } = await seedUsers();
    const client = await connectAsUser(port, adminId);
    const subClient = await connectAsUser(port, adminId);
    await new Promise<void>((resolve) => {
      subClient.emit("userService:subscribe", { entryId: regularAId }, () =>
        resolve()
      );
    });
    const subs = await emitWithAck(client, "userService:adminGetSubscribers", {
      id: regularAId,
    });
    expect(
      (subs as { subscribers: unknown[] }).subscribers.length
    ).toBeGreaterThanOrEqual(1);

    const unsubs = await emitWithAck(
      client,
      "userService:adminUnsubscribeAll",
      { id: regularAId }
    );
    expect(
      (unsubs as { unsubscribed: number }).unsubscribed
    ).toBeGreaterThanOrEqual(1);
    subClient.close();
    client.close();
  });

  it("adminReemit requires Admin and emits event when row exists", async () => {
    const { adminId, regularAId } = await seedUsers();
    const client = await connectAsUser(port, adminId);
    await new Promise<void>((resolve) => {
      client.emit("userService:subscribe", { entryId: regularAId }, () =>
        resolve()
      );
    });
    const updateEvent = `userService:update:${regularAId}`;
    const pushed = waitFor(client, updateEvent);
    const res = await emitWithAck(client, "userService:adminReemit", {
      id: regularAId,
    });
    expect(res).toBeDefined();
    await pushed; // should resolve if emitted
    client.close();
  });
});
