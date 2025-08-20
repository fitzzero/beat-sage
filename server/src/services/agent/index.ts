import BaseService from "../../core/baseService";
import { prisma } from "../../db";
import type { Agent, Prisma } from "@prisma/client";
import type { AgentServiceMethods } from "@shared/types";

// No service-wide checkAccess override; methods perform ownership/ACL checks explicitly

class AgentService extends BaseService<
  "agent",
  Agent,
  Prisma.AgentUncheckedCreateInput,
  Prisma.AgentUncheckedUpdateInput,
  AgentServiceMethods
> {
  constructor() {
    super({ model: "agent", hasEntryACL: true, serviceName: "agentService" });

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

  // Subscription for agents uses BaseService.subscribe via socket event

  public createAgent = this.defineMethod(
    "createAgent",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const acl = [{ userId: socket.userId, level: "Admin" as const }];
      const created = await this.create({
        ownerId: socket.userId,
        name: payload.name,
        description: payload.description,
        instructions: payload.instructions,
        defaultModelId: payload.defaultModelId ?? null,
        acl: acl as unknown as Prisma.InputJsonValue,
      });
      return this.exactResponse("createAgent", { id: created.id });
    }
  );

  private async hasModerateForEntry(
    userId: string,
    id: string
  ): Promise<boolean> {
    const row = await prisma.agent.findUnique({
      where: { id },
      select: { ownerId: true, acl: true },
    });
    if (!row) return false;
    if (row.ownerId === userId) return true;
    const aclList =
      (row.acl as unknown as Array<{
        userId: string;
        level: "Read" | "Moderate" | "Admin";
      }>) || [];
    const ace = aclList.find((a) => a.userId === userId);
    return ace ? ace.level === "Moderate" || ace.level === "Admin" : false;
  }

  public updateAgent = this.defineMethod(
    "updateAgent",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const allowed =
        this.hasServiceAccess(socket, "Moderate") ||
        (await this.hasModerateForEntry(socket.userId, payload.id));
      if (!allowed) throw new Error("Insufficient permissions");
      const updateData: Record<string, unknown> = {};
      if (payload.data.name !== undefined) updateData.name = payload.data.name;
      if (payload.data.description !== undefined)
        updateData.description = payload.data.description;
      if (payload.data.instructions !== undefined)
        updateData.instructions = payload.data.instructions;
      if (payload.data.defaultModelId !== undefined)
        updateData.defaultModelId = payload.data.defaultModelId;

      const updated = await this.update(
        payload.id,
        updateData as Prisma.AgentUncheckedUpdateInput
      );
      return this.exactResponse(
        "updateAgent",
        updated ? { id: payload.id } : undefined
      );
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  public deleteAgent = this.defineMethod(
    "deleteAgent",
    "Admin",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const canAdmin =
        this.hasServiceAccess(socket, "Admin") ||
        (await this.hasModerateForEntry(socket.userId, payload.id));
      if (!canAdmin) throw new Error("Insufficient permissions");
      await this.delete(payload.id);
      return this.exactResponse("deleteAgent", {
        id: payload.id,
        deleted: true,
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  public listMine = this.defineMethod(
    "listMine",
    "Read",
    async (_payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      // Simple owner-based list for now. Future: include ACL membership.
      const rows = await prisma.agent.findMany({
        where: { ownerId: socket.userId },
        select: { id: true, name: true },
      });
      return this.exactResponse(
        "listMine",
        rows as Array<{ id: string; name: string }>
      );
    }
  );

  public listAll = this.defineMethod(
    "listAll",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const page = Math.max(1, Math.floor(payload.page ?? 1));
      const pageSizeRaw = Math.floor(payload.pageSize ?? 25);
      const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
      const offset = (page - 1) * pageSize;
      const rows = await prisma.agent.findMany({
        select: { id: true, name: true },
        skip: offset,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
      });
      return this.exactResponse(
        "listAll",
        rows as Array<{ id: string; name: string }>
      );
    }
  );

  // Keep default checkAccess deny; per-method checks query ownership/ACL as needed
}

export default AgentService;
