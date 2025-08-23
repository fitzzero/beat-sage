import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import type { Prisma, Skill as PrismaSkill } from "@prisma/client";
import type { SkillServiceMethods } from "@shared/types";

export default class SkillService extends BaseService<
  "skill",
  PrismaSkill,
  Prisma.SkillUncheckedCreateInput,
  Prisma.SkillUncheckedUpdateInput,
  SkillServiceMethods
> {
  constructor() {
    super({ model: "skill", hasEntryACL: false, serviceName: "skillService" });
  }

  public listMySkills = this.defineMethod(
    "listMySkills",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const characterId = (payload as { characterId: string }).characterId;
      // Ensure ownership of the character
      const owner = await (
        this.db["character"] as unknown as {
          findUnique: (args: {
            where: { id: string };
            select: { userId: boolean };
          }) => Promise<{ userId: string } | null>;
        }
      ).findUnique({ where: { id: characterId }, select: { userId: true } });
      if (!owner || owner.userId !== socket.userId) return this.exactResponse("listMySkills", []);

      const rows = await (
        this.delegate as unknown as {
          findMany: (args: { where: { characterId: string } }) => Promise<PrismaSkill[]>;
        }
      ).findMany({ where: { characterId } });
      return this.exactResponse("listMySkills", rows);
    }
  );

  public updateSkill = this.defineMethod(
    "updateSkill",
    "Moderate",
    async (payload) => {
      const id = (payload as { id: string }).id;
      const patch = (payload as { patch: Prisma.SkillUncheckedUpdateInput }).patch;
      const updated = await this.update(id, patch);
      return this.exactResponse("updateSkill", updated);
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
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
            select: { character: { select: { userId: true } } };
          }) => Promise<{ character: { userId: string } } | null>;
        }
      ).findUnique({
        where: { id: entryId },
        select: { character: { select: { userId: true } } },
      });
      if (!row || row.character.userId !== userId) return false;
      return requiredLevel === "Read" || requiredLevel === "Moderate";
    } catch {
      return false;
    }
  }
}


