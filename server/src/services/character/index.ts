import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import type { Prisma, Character as PrismaCharacter } from "@prisma/client";
import type { CharacterServiceMethods } from "@shared/types";

// Method types imported from shared/types

export default class CharacterService extends BaseService<
  "character",
  PrismaCharacter,
  Prisma.CharacterUncheckedCreateInput,
  Prisma.CharacterUncheckedUpdateInput,
  CharacterServiceMethods
> {
  constructor() {
    super({
      model: "character",
      hasEntryACL: false,
      serviceName: "characterService",
    });
  }

  public createCharacter = this.defineMethod(
    "createCharacter",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const created = await this.create({
        userId: socket.userId,
        name: (payload as { name: string }).name,
      } as Prisma.CharacterUncheckedCreateInput);
      return this.exactResponse("createCharacter", {
        id: (created as unknown as { id: string }).id,
      });
    }
  );

  public updateCharacter = this.defineMethod(
    "updateCharacter",
    "Moderate",
    async (payload, socket) => {
      await this.ensureAccessForMethod("Moderate", socket, (payload as { id: string }).id);
      const updated = await this.update(
        (payload as { id: string }).id,
        (payload as { patch: Prisma.CharacterUncheckedUpdateInput }).patch
      );
      return this.exactResponse("updateCharacter", updated);
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  public listMine = this.defineMethod(
    "listMine",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const page = Math.max(1, Math.floor(((payload as { page?: number }).page ?? 1)));
      const pageSizeRaw = Math.floor(((payload as { pageSize?: number }).pageSize ?? 25));
      const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
      const skip = (page - 1) * pageSize;
      const rows = await (
        this.delegate as unknown as {
          findMany: (args: {
            where?: Record<string, unknown>;
            skip?: number;
            take?: number;
          }) => Promise<PrismaCharacter[]>;
        }
      ).findMany({ where: { userId: socket.userId }, skip, take: pageSize });
      return this.exactResponse("listMine", rows);
    }
  );

  protected async evaluateEntryAccess(
    userId: string,
    entryId: string,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin",
    _socket: CustomSocket
  ): Promise<boolean> {
    try {
      const row = await (
        this.delegate as unknown as {
          findUnique: (args: {
            where: { id: string };
            select?: { userId?: boolean };
          }) => Promise<{ userId: string } | null>;
        }
      ).findUnique({ where: { id: entryId }, select: { userId: true } });
      if (!row) return false;
      if (row.userId !== userId) return false;
      return requiredLevel === "Read" || requiredLevel === "Moderate";
    } catch {
      return false;
    }
  }
}
