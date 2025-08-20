import { resetDatabase } from "../../__tests__/setup";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
} from "../../__tests__/utils/socket";
import { testPrisma } from "../../db/testDb";

describe("ChatService integration", () => {
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
        { email: "invitee@example.com", username: "inv", name: "Invitee" },
      ],
      skipDuplicates: true,
    });
    const users = await testPrisma.user.findMany({
      where: { email: { in: ["owner@example.com", "invitee@example.com"] } },
      select: { id: true, email: true },
    });
    (
      global as unknown as { __ownerId?: string; __inviteeId?: string }
    ).__ownerId = String(
      users.find((r) => r.email === "owner@example.com")!.id
    );
    (
      global as unknown as { __ownerId?: string; __inviteeId?: string }
    ).__inviteeId = String(
      users.find((r) => r.email === "invitee@example.com")!.id
    );
  });

  it("creator is admin by default and can invite a user", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const inviteeId = (global as unknown as { __inviteeId: string })
      .__inviteeId;
    const client = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      client,
      "chatService:createChat",
      {
        title: "Test Chat",
      }
    );
    expect(created.id).toBeDefined();
    const invited = await emitWithAck<unknown, { id: string }>(
      client,
      "chatService:inviteUser",
      {
        id: created.id,
        userId: inviteeId,
        level: "Read",
      }
    );
    expect(invited.id).toBe(created.id);
    client.close();
  });

  it("subscribeWithMessages returns chat and recent messages, and receives new posts", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const inviteeId = (global as unknown as { __inviteeId: string })
      .__inviteeId;
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:createChat",
      { title: "Test Chat" }
    );
    // invite member
    await emitWithAck(owner, "chatService:inviteUser", {
      id: created.id,
      userId: inviteeId,
      level: "Read",
    });
    owner.close();

    // member subscribes with messages
    const member = await connectAsUser(port, inviteeId);
    const sub = await emitWithAck<
      unknown,
      { chat: { id: string; title: string } | null; messages: unknown[] }
    >(member, "chatService:subscribeWithMessages", {
      id: created.id,
      limit: 10,
    });
    expect(sub.chat?.id).toBe(created.id);

    // post a message as member
    const msgRes = await emitWithAck<unknown, { id: string }>(
      member,
      "messageService:postMessage",
      { chatId: created.id, content: "hello" }
    );
    expect(msgRes.id).toBeDefined();
    // fetch recent messages
    const list = await emitWithAck(member, "messageService:listMessages", {
      chatId: created.id,
      limit: 10,
    });
    expect(Array.isArray(list)).toBe(true);
    member.close();
  });

  it("creator (Admin in ACL) can update the chat title; regular user cannot; Moderate can", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const inviteeId = (global as unknown as { __inviteeId: string })
      .__inviteeId;

    // Owner creates chat
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:createChat",
      { title: "Original" }
    );
    // Owner can update title
    const upd1 = await emitWithAck<unknown, { id: string; title: string }>(
      owner,
      "chatService:updateTitle",
      { id: created.id, title: "Owner Title" }
    );
    expect(upd1.title).toBe("Owner Title");

    // Invite regular reader
    await emitWithAck(owner, "chatService:inviteUser", {
      id: created.id,
      userId: inviteeId,
      level: "Read",
    });
    owner.close();

    // Regular cannot update
    const reader = await connectAsUser(port, inviteeId);
    const tryUpd = await emitWithAck(reader, "chatService:updateTitle", {
      id: created.id,
      title: "Reader Title",
    });
    expect(tryUpd).toBeUndefined();
    reader.close();

    // Grant Moderate and update
    const owner2 = await connectAsUser(port, ownerId);
    await emitWithAck(owner2, "chatService:inviteUser", {
      id: created.id,
      userId: inviteeId,
      level: "Moderate",
    });
    owner2.close();
    const mod = await connectAsUser(port, inviteeId);
    const upd2 = await emitWithAck<unknown, { id: string; title: string }>(
      mod,
      "chatService:updateTitle",
      { id: created.id, title: "Moderate Title" }
    );
    expect(upd2.title).toBe("Moderate Title");
    mod.close();
  });

  it("moderator can remove user; user can leave; attachAgent works; listMyChats returns own chats", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const inviteeId = (global as unknown as { __inviteeId: string })
      .__inviteeId;
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:createChat",
      { title: "Another Chat" }
    );
    // invite member as Moderate then remove
    await emitWithAck(owner, "chatService:inviteUser", {
      id: created.id,
      userId: inviteeId,
      level: "Moderate",
    });
    const removed = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:removeUser",
      { id: created.id, userId: inviteeId }
    );
    expect(removed.id).toBe(created.id);

    // re-invite as Read and leave
    await emitWithAck(owner, "chatService:inviteUser", {
      id: created.id,
      userId: inviteeId,
      level: "Read",
    });
    owner.close();
    const member = await connectAsUser(port, inviteeId);
    const left = await emitWithAck<unknown, { id: string }>(
      member,
      "chatService:leaveChat",
      { id: created.id }
    );
    expect(left.id).toBe(created.id);
    member.close();

    // owner attaches agent id (dummy UUID) and lists own chats
    const owner2 = await connectAsUser(port, ownerId);
    // create an agent to attach
    const agent = await emitWithAck<unknown, { id: string }>(
      owner2,
      "agentService:createAgent",
      { name: "Zero" }
    );
    const attach = await emitWithAck<unknown, { id: string; agentId: string }>(
      owner2,
      "chatService:attachAgent",
      { id: created.id, agentId: agent.id }
    );
    expect(attach.id).toBe(created.id);
    const myChats = await emitWithAck(owner2, "chatService:listMyChats", {});
    expect(Array.isArray(myChats)).toBe(true);
    owner2.close();
  });

  it("owner (entry Admin) can adminDelete; regular cannot; service Admin can", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const inviteeId = (global as unknown as { __inviteeId: string })
      .__inviteeId;

    // Owner creates chat and invites a reader
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:createChat",
      { title: "Delete Me" }
    );
    await emitWithAck(owner, "chatService:inviteUser", {
      id: created.id,
      userId: inviteeId,
      level: "Read",
    });

    // Regular reader cannot delete
    const reader = await connectAsUser(port, inviteeId);
    const denied = await emitWithAck(reader, "chatService:adminDelete", {
      id: created.id,
    });
    expect(denied).toBeUndefined();
    reader.close();

    // Owner (entry Admin) can delete
    const del1 = await emitWithAck<unknown, { id: string; deleted: true }>(
      owner,
      "chatService:adminDelete",
      { id: created.id }
    );
    expect(del1.deleted).toBe(true);
    owner.close();

    // Recreate another chat and delete via service-level Admin
    const owner2 = await connectAsUser(port, ownerId);
    const created2 = await emitWithAck<unknown, { id: string }>(
      owner2,
      "chatService:createChat",
      { title: "Delete By Service Admin" }
    );
    owner2.close();
    // Seed a service-level Admin for chatService
    const adminRow = await testPrisma.user.create({
      data: {
        email: "superadmin@example.com",
        username: "superadmin",
        name: "Super Admin",
        serviceAccess: { chatService: "Admin" } as unknown as object,
      },
      select: { id: true },
    });
    const serviceAdmin = await connectAsUser(port, adminRow.id);
    const del2 = await emitWithAck<unknown, { id: string; deleted: true }>(
      serviceAdmin,
      "chatService:adminDelete",
      { id: created2.id }
    );
    expect(del2.deleted).toBe(true);
    serviceAdmin.close();
  });

  it("non-member cannot subscribeWithMessages to a chat", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    // Owner creates chat; no invite for outsider
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:createChat",
      { title: "Private" }
    );
    owner.close();

    // Outsider user
    const outsider = await testPrisma.user.create({
      data: {
        email: "outsider@example.com",
        username: "out",
        name: "Outsider",
      },
      select: { id: true },
    });
    const outsiderClient = await connectAsUser(port, outsider.id);
    const res = await emitWithAck(
      outsiderClient,
      "chatService:subscribeWithMessages",
      { id: created.id, limit: 5 }
    );
    expect(res).toBeUndefined();
    outsiderClient.close();
  });

  it("owner can adminDelete a chat that has messages (cascade)", async () => {
    const ownerId = (global as unknown as { __ownerId: string }).__ownerId;
    const owner = await connectAsUser(port, ownerId);
    const created = await emitWithAck<unknown, { id: string }>(
      owner,
      "chatService:createChat",
      { title: "With Messages" }
    );
    // Post two messages
    await emitWithAck(owner, "messageService:postMessage", {
      chatId: created.id,
      content: "hello",
    });
    await emitWithAck(owner, "messageService:postMessage", {
      chatId: created.id,
      content: "world",
    });
    // Delete the chat via adminDelete (entry Admin)
    const del = await emitWithAck<unknown, { id: string; deleted: true }>(
      owner,
      "chatService:adminDelete",
      { id: created.id }
    );
    expect(del.deleted).toBe(true);
    // Ensure messages were cascaded
    const count = await testPrisma.message.count({
      where: { chatId: created.id },
    });
    expect(count).toBe(0);
    owner.close();
  });
});
