import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import type {
  Prisma,
  Party as PrismaParty,
  PartyMember as PrismaPartyMember,
} from "@prisma/client";
import type { PartyServiceMethods, PartySnapshot } from "@shared/types";

export default class PartyService extends BaseService<
  "party",
  PrismaParty,
  Prisma.PartyUncheckedCreateInput,
  Prisma.PartyUncheckedUpdateInput,
  PartyServiceMethods
> {
  constructor() {
    super({ model: "party", hasEntryACL: false, serviceName: "partyService" });
  }

  private async isOwnerOfCharacter(
    userId: string,
    characterId: string
  ): Promise<boolean> {
    const owner = await (
      this.db["character"] as unknown as {
        findUnique: (args: {
          where: { id: string };
          select: { userId: boolean };
        }) => Promise<{ userId: string } | null>;
      }
    ).findUnique({ where: { id: characterId }, select: { userId: true } });
    return !!owner && owner.userId === userId;
  }

  private async getSnapshot(partyId: string): Promise<PartySnapshot> {
    const party = await (
      this.delegate as unknown as {
        findUnique: (args: {
          where: { id: string };
          select: { hostCharacterId: boolean };
        }) => Promise<{ hostCharacterId: string } | null>;
      }
    ).findUnique({ where: { id: partyId }, select: { hostCharacterId: true } });
    if (!party) throw new Error("Party not found");
    const members = await (
      this.db["partyMember"] as unknown as {
        findMany: (args: {
          where: { partyId: string };
          select: { characterId: boolean; isReady: boolean };
        }) => Promise<Array<{ characterId: string; isReady: boolean }>>;
      }
    ).findMany({
      where: { partyId },
      select: { characterId: true, isReady: true },
    });
    return { hostCharacterId: party.hostCharacterId, members };
  }

  public createParty = this.defineMethod(
    "createParty",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const hostCharacterId = (payload as { hostCharacterId: string })
        .hostCharacterId;
      const owns = await this.isOwnerOfCharacter(
        socket.userId,
        hostCharacterId
      );
      if (!owns) throw new Error("Insufficient permissions");
      // Idempotency: if a party already exists for this host, return it
      const existing = await (
        this.delegate as unknown as {
          findFirst: (args: {
            where: { hostCharacterId: string };
            select: { id: boolean };
          }) => Promise<{ id: string } | null>;
        }
      ).findFirst({ where: { hostCharacterId }, select: { id: true } });

      const partyId = existing
        ? existing.id
        : (
            (await this.create({
              hostCharacterId,
            } as Prisma.PartyUncheckedCreateInput)) as unknown as { id: string }
          ).id;

      // Ensure host is a member of the party
      await (
        this.db["partyMember"] as unknown as {
          upsert: (args: {
            where: { characterId: string };
            update: { partyId: string };
            create: { partyId: string; characterId: string };
          }) => Promise<PrismaPartyMember>;
        }
      ).upsert({
        where: { characterId: hostCharacterId },
        update: { partyId },
        create: { partyId, characterId: hostCharacterId },
      });

      return this.exactResponse("createParty", { id: partyId });
    }
  );

  public joinParty = this.defineMethod(
    "joinParty",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const { partyId, characterId } = payload as {
        partyId: string;
        characterId: string;
      };
      const owns = await this.isOwnerOfCharacter(socket.userId, characterId);
      if (!owns) throw new Error("Insufficient permissions");
      await (
        this.db["partyMember"] as unknown as {
          upsert: (args: {
            where: { characterId: string };
            update: { partyId: string };
            create: { partyId: string; characterId: string };
          }) => Promise<PrismaPartyMember>;
        }
      ).upsert({
        where: { characterId },
        update: { partyId },
        create: { partyId, characterId },
      });
      const snap = (await this.getSnapshot(partyId)) as unknown as Record<
        string,
        unknown
      >;
      this.emitUpdate(partyId, snap);
      return this.exactResponse("joinParty", { id: partyId });
    }
  );

  public leaveParty = this.defineMethod(
    "leaveParty",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const { partyId, characterId } = payload as {
        partyId: string;
        characterId: string;
      };
      const owns = await this.isOwnerOfCharacter(socket.userId, characterId);
      if (!owns) throw new Error("Insufficient permissions");
      await (
        this.db["partyMember"] as unknown as {
          delete: (args: {
            where: { characterId: string };
          }) => Promise<unknown>;
        }
      ).delete({ where: { characterId } });
      const snap = (await this.getSnapshot(partyId)) as unknown as Record<
        string,
        unknown
      >;
      this.emitUpdate(partyId, snap);
      return this.exactResponse("leaveParty", { id: partyId });
    }
  );

  public setReady = this.defineMethod(
    "setReady",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const { partyId, characterId, isReady } = payload as {
        partyId: string;
        characterId: string;
        isReady: boolean;
      };
      const owns = await this.isOwnerOfCharacter(socket.userId, characterId);
      if (!owns) throw new Error("Insufficient permissions");
      await (
        this.db["partyMember"] as unknown as {
          update: (args: {
            where: { characterId: string };
            data: { isReady: boolean };
          }) => Promise<PrismaPartyMember>;
        }
      ).update({ where: { characterId }, data: { isReady } });
      const snap = (await this.getSnapshot(partyId)) as unknown as Record<
        string,
        unknown
      >;
      this.emitUpdate(partyId, snap);
      return this.exactResponse("setReady", { partyId, characterId, isReady });
    }
  );

  public subscribeWithMembers = this.defineMethod(
    "subscribeWithMembers",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const partyId = (payload as { partyId: string }).partyId;
      // Register subscription by partyId
      if (!this.subscribers.has(partyId))
        this.subscribers.set(partyId, new Set());
      this.subscribers.get(partyId)!.add(socket);
      return this.exactResponse(
        "subscribeWithMembers",
        await this.getSnapshot(partyId)
      );
    },
    { resolveEntryId: (p) => (p as { partyId: string }).partyId }
  );

  protected async evaluateEntryAccess(
    userId: string,
    entryId: string,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin",
    _socket: CustomSocket
  ): Promise<boolean> {
    try {
      // Member or host can Read/Moderate
      const party = await (
        this.delegate as unknown as {
          findUnique: (args: {
            where: { id: string };
            select: { hostCharacterId: boolean };
          }) => Promise<{ hostCharacterId: string } | null>;
        }
      ).findUnique({
        where: { id: entryId },
        select: { hostCharacterId: true },
      });
      if (!party) return false;
      const hostOk = await this.isOwnerOfCharacter(
        userId,
        party.hostCharacterId
      );
      if (hostOk)
        return requiredLevel === "Read" || requiredLevel === "Moderate";
      const isMember = await (
        this.db["partyMember"] as unknown as {
          findFirst: (args: {
            where: { partyId: string; character: { userId: string } };
          }) => Promise<PrismaPartyMember | null>;
        }
      ).findFirst({ where: { partyId: entryId, character: { userId } } });
      if (!isMember) return false;
      return requiredLevel === "Read" || requiredLevel === "Moderate";
    } catch {
      return false;
    }
  }
}
