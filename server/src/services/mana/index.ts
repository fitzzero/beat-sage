import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import type { Prisma, Mana as PrismaMana } from "@prisma/client";

// ManaService provides subscription to a character's mana using characterId as the entry key
// Emits and subscriptions are keyed by characterId (not the Mana row id)
export default class ManaService extends BaseService<
  "mana",
  PrismaMana,
  Prisma.ManaUncheckedCreateInput,
  Prisma.ManaUncheckedUpdateInput,
  Record<string, never>
> {
  constructor() {
    super({ model: "mana", hasEntryACL: false, serviceName: "manaService" });
  }

  // Override subscribe to treat entryId as characterId
  public async subscribe(
    entryId: string,
    socket: CustomSocket,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin" = "Read"
  ): Promise<Record<string, unknown> | null> {
    if (!socket.userId) return null;

    // Enforce access via evaluateEntryAccess using characterId
    const allowed = await this.evaluateEntryAccess(
      socket.userId,
      entryId,
      requiredLevel,
      socket
    );
    if (!allowed) return null;

    // Register subscription keyed by characterId
    if (!this.subscribers.has(entryId)) this.subscribers.set(entryId, new Set());
    this.subscribers.get(entryId)!.add(socket);

    // Return current mana state for the character
    const row = await (
      this.db[this.model] as unknown as {
        findUnique: (args: {
          where: { characterId: string };
        }) => Promise<PrismaMana | null>;
      }
    ).findUnique({ where: { characterId: entryId } });
    return (row as unknown as Record<string, unknown>) ?? null;
  }

  // Ensure owners can Read/Moderate their own character's mana using characterId
  protected async evaluateEntryAccess(
    userId: string,
    entryId: string,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin",
    _socket: CustomSocket
  ): Promise<boolean> {
    try {
      // entryId is characterId
      const character = await (
        this.db["character"] as unknown as {
          findUnique: (args: {
            where: { id: string };
            select: { userId: boolean };
          }) => Promise<{ userId: string } | null>;
        }
      ).findUnique({ where: { id: entryId }, select: { userId: true } });
      if (!character || character.userId !== userId) return false;
      return requiredLevel === "Read" || requiredLevel === "Moderate";
    } catch {
      return false;
    }
  }

  // Emit update to subscribers keyed by characterId
  protected emitUpdateByCharacterId(
    characterId: string,
    data: Record<string, unknown>
  ) {
    this.subscribers.get(characterId)?.forEach((socket) => {
      socket.emit(`${this.serviceName}:update:${characterId}`, data);
    });
  }
}


