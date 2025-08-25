import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import type {
  Prisma,
  Instance as PrismaInstance,
  InstanceMob as PrismaInstanceMob,
} from "@prisma/client";
import type { InstanceServiceMethods, InstanceSnapshot } from "@shared/types";

type ActiveInstance = {
  id: string;
  snapshot: InstanceSnapshot;
  subscribers: Set<CustomSocket>;
};

export default class InstanceService extends BaseService<
  "instance",
  PrismaInstance,
  Prisma.InstanceUncheckedCreateInput,
  Prisma.InstanceUncheckedUpdateInput,
  InstanceServiceMethods
> {
  private active: Map<string, ActiveInstance> = new Map<
    string,
    ActiveInstance
  >();

  constructor() {
    super({
      model: "instance",
      hasEntryACL: false,
      serviceName: "instanceService",
    });
  }

  private async getPartyMemberIds(partyId: string): Promise<string[]> {
    const rows = await (
      this.db["partyMember"] as unknown as {
        findMany: (args: {
          where: { partyId: string };
          select: { characterId: boolean };
        }) => Promise<Array<{ characterId: string }>>;
      }
    ).findMany({ where: { partyId }, select: { characterId: true } });
    return rows.map((r) => r.characterId);
  }

  private async buildSnapshot(inst: {
    id: string;
    partyId: string;
    locationId: string;
    songId: string;
    status: PrismaInstance["status"];
    startedAt: Date | null;
  }): Promise<InstanceSnapshot> {
    const mobs = await (
      this.db["instanceMob"] as unknown as {
        findMany: (args: {
          where: { instanceId: string };
        }) => Promise<PrismaInstanceMob[]>;
      }
    ).findMany({ where: { instanceId: inst.id } });
    const memberIds = await this.getPartyMemberIds(inst.partyId);
    return {
      status: inst.status,
      startedAt: inst.startedAt,
      songId: inst.songId,
      locationId: inst.locationId,
      mobs,
      party: { memberIds },
    };
  }

  private ensureActiveRecord(id: string, snapshot: InstanceSnapshot) {
    if (!this.active.has(id)) {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const value: ActiveInstance = {
        id,
        snapshot,
        subscribers: new Set<CustomSocket>(),
      };
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      this.active.set(id, value);
    }
    const rec = this.active.get(id) as ActiveInstance;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    rec.snapshot = snapshot;
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  }

  public createInstance = this.defineMethod(
    "createInstance",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const { partyId, locationId, songId } = payload as {
        partyId: string;
        locationId: string;
        songId: string;
      };

      // Simple membership check: user must be host or member of party
      const party = await (
        this.db["party"] as unknown as {
          findUnique: (args: {
            where: { id: string };
            select: { hostCharacterId: boolean };
          }) => Promise<{ hostCharacterId: string } | null>;
        }
      ).findUnique({
        where: { id: partyId },
        select: { hostCharacterId: true },
      });
      if (!party) throw new Error("Party not found");

      const isHostOwner = await (
        this.db["character"] as unknown as {
          findUnique: (args: {
            where: { id: string };
            select: { userId: boolean };
          }) => Promise<{ userId: string } | null>;
        }
      ).findUnique({
        where: { id: party.hostCharacterId },
        select: { userId: true },
      });
      const isMember = await (
        this.db["partyMember"] as unknown as {
          findFirst: (args: {
            where: { partyId: string; character: { userId: string } };
          }) => Promise<{ characterId: string } | null>;
        }
      ).findFirst({ where: { partyId, character: { userId: socket.userId } } });
      if (!(isHostOwner?.userId === socket.userId || isMember)) {
        throw new Error("Insufficient permissions");
      }

      const created = await this.create({
        partyId,
        locationId,
        songId,
      } as Prisma.InstanceUncheckedCreateInput);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const snapshot: InstanceSnapshot = await this.buildSnapshot({
        id: created.id,
        partyId,
        locationId,
        songId,
        status: created.status,
        startedAt: created.startedAt ?? null,
      });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      this.ensureActiveRecord(created.id, snapshot);
      return this.exactResponse("createInstance", {
        id: created.id,
        status: created.status,
      });
    }
  );

  // Custom subscribe: returns the in-memory snapshot, and registers subscriber for periodic emits
  public async subscribe(
    entryId: string,
    socket: CustomSocket,
    _requiredLevel: "Public" | "Read" | "Moderate" | "Admin" = "Read"
  ): Promise<Record<string, unknown> | null> {
    if (!socket.userId) return null;

    // Basic membership check against party
    const inst = await (
      this.delegate as unknown as {
        findUnique: (args: {
          where: { id: string };
          select: {
            id: boolean;
            partyId: boolean;
            songId: boolean;
            locationId: boolean;
            status: boolean;
            startedAt: boolean;
          };
        }) => Promise<{
          id: string;
          partyId: string;
          songId: string;
          locationId: string;
          status: PrismaInstance["status"];
          startedAt: Date | null;
        } | null>;
      }
    ).findUnique({
      where: { id: entryId },
      select: {
        id: true,
        partyId: true,
        songId: true,
        locationId: true,
        status: true,
        startedAt: true,
      },
    });
    if (!inst) return null;
    const isHostOrMember = await (
      this.db["partyMember"] as unknown as {
        findFirst: (args: {
          where: { partyId: string; character: { userId: string } };
        }) => Promise<{ characterId: string } | null>;
      }
    ).findFirst({
      where: { partyId: inst.partyId, character: { userId: socket.userId } },
    });
    const hostOwner = await (
      this.db["party"] as unknown as {
        findUnique: (args: {
          where: { id: string };
          select: { host: { select: { userId: boolean } } };
        }) => Promise<{ host: { userId: string } } | null>;
      }
    ).findUnique({
      where: { id: inst.partyId },
      select: { host: { select: { userId: true } } },
    });
    if (!(isHostOrMember || hostOwner?.host.userId === socket.userId))
      return null;

    // Build or reuse in-memory snapshot
    if (!this.active.has(entryId)) {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const snap: InstanceSnapshot = await this.buildSnapshot(inst);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      this.ensureActiveRecord(entryId, snap);
    }
    const rec = this.active.get(entryId)!;
    rec.subscribers.add(socket);
    // Return current snapshot
    return rec.snapshot as unknown as Record<string, unknown>;
  }

  // Emit helper for instance tick/state changes
  private emitInstanceSnapshot(id: string) {
    const rec = this.active.get(id);
    if (!rec) return;
    const payload = rec.snapshot as unknown as Record<string, unknown>;
    this.subscribers.get(id)?.forEach((s) => {
      s.emit(`${this.serviceName}:update:${id}`, payload);
    });
    rec.subscribers.forEach((s) => {
      s.emit(`${this.serviceName}:update:${id}`, payload);
    });
  }
}
