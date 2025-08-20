import BaseService from "../../core/baseService";
import { prisma } from "../../db";
import type { Prisma, Chat } from "@prisma/client";
import type { ChatServiceMethods } from "@shared/types";

class ChatService extends BaseService<
  "chat",
  Chat,
  Prisma.ChatUncheckedCreateInput,
  Prisma.ChatUncheckedUpdateInput,
  ChatServiceMethods
> {
  constructor() {
    super({ model: "chat", hasEntryACL: true, serviceName: "chatService" });

    this.installAdminMethods({
      expose: {
        list: true,
        get: true,
        create: true,
        update: true,
        delete: true,
        setEntryACL: this.hasEntryACL,
        getSubscribers: true,
        reemit: true,
        unsubscribeAll: true,
      },
      access: {
        list: "Moderate",
        get: "Moderate",
        create: "Read",
        update: "Moderate",
        delete: "Admin",
        setEntryACL: "Admin",
        getSubscribers: "Admin",
        reemit: "Admin",
        unsubscribeAll: "Admin",
      },
    });
  }

  public createChat = this.defineMethod(
    "createChat",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const acl = [
        { userId: socket.userId, level: "Admin" as const },
        ...(payload.members || []),
      ];
      const created = await this.create({
        createdBy: socket.userId,
        agentId: payload.agentId ?? null,
        title: payload.title,
        acl: acl as unknown as Prisma.InputJsonValue,
      });
      return this.exactResponse("createChat", { id: created.id });
    }
  );

  public inviteUser = this.defineMethod(
    "inviteUser",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      // Only moderators/admins of this chat can invite
      const row = await prisma.chat.findUnique({
        where: { id: payload.id },
        select: { acl: true },
      });
      const aclList =
        (row?.acl as unknown as Array<{
          userId: string;
          level: "Read" | "Moderate" | "Admin";
        }>) || [];
      const caller = aclList.find((a) => a.userId === socket.userId);
      if (
        !caller ||
        (caller.level !== "Moderate" && caller.level !== "Admin")
      ) {
        throw new Error("Insufficient permissions");
      }
      const acl = [
        ...aclList.filter((a) => a.userId !== payload.userId),
        {
          userId: payload.userId,
          level: payload.level,
        },
      ];
      await this.update(payload.id, {
        acl: acl as unknown as Prisma.InputJsonValue,
      } as Prisma.ChatUncheckedUpdateInput);
      // this.update already emitted
      return this.exactResponse("inviteUser", { id: payload.id });
    }
  );

  public subscribeWithMessages = this.defineMethod(
    "subscribeWithMessages",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");

      // Subscribe to the chat using BaseService (enforces ACL via hasEntryACL)
      const current = (await this.subscribe(payload.id, socket, "Read")) as {
        id: string;
        title: string;
      } | null;
      if (current === null) throw new Error("Access denied or not found");

      // Join Socket.IO room for message fan-out
      const room = `chat:${payload.id}`;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (socket as unknown as { join: (room: string) => void }).join(room);

      // Fetch recent messages
      const limit = Math.min(Math.max(Math.floor(payload.limit ?? 50), 1), 200);
      const rows = await prisma.message.findMany({
        where: { chatId: payload.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, role: true, content: true, createdAt: true },
      });

      return this.exactResponse("subscribeWithMessages", {
        chat: current,
        messages: rows,
      });
    }
  );

  public removeUser = this.defineMethod(
    "removeUser",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const row = await prisma.chat.findUnique({
        where: { id: payload.id },
        select: { acl: true },
      });
      const aclList =
        (row?.acl as unknown as Array<{
          userId: string;
          level: "Read" | "Moderate" | "Admin";
        }>) || [];
      const caller = aclList.find((a) => a.userId === socket.userId);
      if (
        !caller ||
        (caller.level !== "Moderate" && caller.level !== "Admin")
      ) {
        throw new Error("Insufficient permissions");
      }
      const acl = aclList.filter((a) => a.userId !== payload.userId);
      await this.update(payload.id, {
        acl: acl as unknown as Prisma.InputJsonValue,
      } as Prisma.ChatUncheckedUpdateInput);
      // this.update already emitted
      return this.exactResponse("removeUser", { id: payload.id });
    }
  );

  public leaveChat = this.defineMethod(
    "leaveChat",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const row = await prisma.chat.findUnique({
        where: { id: payload.id },
        select: { acl: true },
      });
      const aclList =
        (row?.acl as unknown as Array<{
          userId: string;
          level: "Read" | "Moderate" | "Admin";
        }>) || [];
      const acl = aclList.filter((a) => a.userId !== socket.userId);
      await this.update(payload.id, {
        acl: acl as unknown as Prisma.InputJsonValue,
      } as Prisma.ChatUncheckedUpdateInput);
      // this.update already emitted
      return this.exactResponse("leaveChat", { id: payload.id });
    }
  );

  public attachAgent = this.defineMethod(
    "attachAgent",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const row = await prisma.chat.findUnique({
        where: { id: payload.id },
        select: { acl: true },
      });
      const aclList =
        (row?.acl as unknown as Array<{
          userId: string;
          level: "Read" | "Moderate" | "Admin";
        }>) || [];
      const caller = aclList.find((a) => a.userId === socket.userId);
      if (
        !caller ||
        (caller.level !== "Moderate" && caller.level !== "Admin")
      ) {
        throw new Error("Insufficient permissions");
      }
      await this.update(payload.id, {
        agentId: payload.agentId,
      } as Prisma.ChatUncheckedUpdateInput);
      // this.update already emitted full row; but we selected no fields.
      return this.exactResponse("attachAgent", {
        id: payload.id,
        agentId: payload.agentId ?? null,
      });
    }
  );

  public listMyChats = this.defineMethod(
    "listMyChats",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const page = Math.max(1, Math.floor(payload.page ?? 1));
      const pageSizeRaw = Math.floor(payload.pageSize ?? 25);
      const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
      const offset = (page - 1) * pageSize;
      // Simple owner-based listing for now. Future: include ACL membership.
      const own = await prisma.chat.findMany({
        where: { createdBy: socket.userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: pageSize,
      });
      return this.exactResponse("listMyChats", own);
    }
  );

  public updateTitle = this.defineMethod(
    "updateTitle",
    "Moderate",
    async (payload) => {
      const updated = (await this.update(payload.id, {
        title: payload.title,
      } as Prisma.ChatUncheckedUpdateInput)) as
        | { id: string; title: string }
        | undefined;
      return this.exactResponse("updateTitle", updated);
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );
}

export default ChatService;
