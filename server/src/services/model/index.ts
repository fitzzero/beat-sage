import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import { prisma } from "../../db";
import type { Model, Prisma } from "@prisma/client";
import type { ModelServiceMethods } from "@shared/types";

type AccessLevel = "Public" | "Read" | "Moderate" | "Admin";

class ModelService extends BaseService<
  "model",
  Model,
  Prisma.ModelUncheckedCreateInput,
  Prisma.ModelUncheckedUpdateInput,
  ModelServiceMethods
> {
  constructor() {
    super({ model: "model", hasEntryACL: false, serviceName: "modelService" });

    this.installAdminMethods({
      expose: {
        list: true,
        get: true,
        create: true,
        update: true,
        delete: true,
        setEntryACL: false,
        getSubscribers: true,
        reemit: true,
        unsubscribeAll: true,
      },
      access: {
        list: "Read",
        get: "Read",
        create: "Admin",
        update: "Admin",
        delete: "Admin",
        setEntryACL: "Admin",
        getSubscribers: "Admin",
        reemit: "Admin",
        unsubscribeAll: "Admin",
      },
    });
  }

  public listActive = this.defineMethod(
    "listActive",
    "Read",
    async (payload) => {
      const rows = await prisma.model.findMany({
        where: {
          isActive: true,
          ...(payload?.provider ? { provider: payload.provider } : {}),
        },
        select: {
          id: true,
          provider: true,
          modelKey: true,
          displayName: true,
        },
      });
      return this.exactResponse(
        "listActive",
        rows as Array<{
          id: string;
          provider: string;
          modelKey: string;
          displayName: string;
        }>
      );
    }
  );

  public listAll = this.defineMethod("listAll", "Read", async (payload) => {
    const page = Math.max(1, Math.floor(payload.page ?? 1));
    const pageSizeRaw = Math.floor(payload.pageSize ?? 25);
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
    const offset = (page - 1) * pageSize;
    const rows = await prisma.model.findMany({
      where: {
        ...(payload?.provider ? { provider: payload.provider } : {}),
      },
      select: {
        id: true,
        provider: true,
        modelKey: true,
        displayName: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: pageSize,
    });
    return this.exactResponse(
      "listAll",
      rows as Array<{
        id: string;
        provider: string;
        modelKey: string;
        displayName: string;
      }>
    );
  });

  public recordUsage = this.defineMethod(
    "recordUsage",
    "Moderate",
    async (payload, socket) => {
      if (!this.hasServiceAccess(socket, "Moderate")) {
        throw new Error("Insufficient permissions");
      }
      const incInput = Math.max(0, Math.floor(payload.inputTokens ?? 0));
      const incOutput = Math.max(0, Math.floor(payload.outputTokens ?? 0));
      const updated = (await this.update(payload.id, {
        totalRequests: { increment: 1 as unknown as bigint },
        totalInputTokens: { increment: incInput as unknown as bigint },
        totalOutputTokens: { increment: incOutput as unknown as bigint },
        lastUsedAt: new Date(),
      } as Prisma.ModelUncheckedUpdateInput)) as
        | {
            id: string;
            totalRequests: bigint;
            totalInputTokens: bigint;
            totalOutputTokens: bigint;
          }
        | undefined;
      if (!updated) throw new Error("Model not found");
      return this.exactResponse("recordUsage", {
        id: updated.id,
        totalRequests: Number(updated.totalRequests),
        totalInputTokens: Number(updated.totalInputTokens),
        totalOutputTokens: Number(updated.totalOutputTokens),
      });
    }
  );

  protected checkAccess(
    userId: string | undefined,
    _entryId: string,
    _requiredLevel: AccessLevel,
    _socket?: CustomSocket
  ): boolean {
    // No per-entry ACL; rely on service-level ACL only
    return !!userId;
  }
}

export default ModelService;
