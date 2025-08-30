/* eslint-disable max-lines */
import BaseService from "../../core/baseService";
import type { CustomSocket } from "../../core/baseService";
import type { Prisma, Instance as PrismaInstance } from "@prisma/client";
import type { InstanceServiceMethods, InstanceSnapshot } from "@shared/types";
import { gradeBeat } from "./logic/grading";
import {
  advanceMobs,
  applyContactDamage as _applyContactDamage,
} from "./logic/tick";
import { canAccessInstance } from "./acl";
import { buildInstanceSnapshot } from "./snapshot";

type ActiveInstance = {
  id: string;
  snapshot: InstanceSnapshot;
  subscribers: Set<CustomSocket>;
  membersMana: Map<
    string,
    {
      current: number;
      maximum: number;
      rate: number;
      maxRate: number;
      experience: number;
    }
  >; // characterId -> mana state (in-memory during Active)
  ticker?: ReturnType<typeof setInterval> | null;
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

  private async buildSnapshot(inst: {
    id: string;
    partyId: string;
    locationId: string;
    songId: string;
    status: PrismaInstance["status"];
    startedAt: Date | null;
  }): Promise<InstanceSnapshot> {
    return buildInstanceSnapshot(
      this.db as unknown as Parameters<typeof buildInstanceSnapshot>[0],
      inst as unknown as Parameters<typeof buildInstanceSnapshot>[1]
    );
  }

  private ensureActiveRecord(id: string, snapshot: InstanceSnapshot) {
    if (!this.active.has(id)) {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const value: ActiveInstance = {
        id,
        snapshot,
        subscribers: new Set<CustomSocket>(),
        membersMana: new Map(),
        ticker: null,
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

      // Set this instance as the party's active instance
      await (
        this.db["party"] as unknown as {
          update: (args: {
            where: { id: string };
            data: { instanceId: string };
          }) => Promise<unknown>;
        }
      ).update({
        where: { id: partyId },
        data: { instanceId: created.id },
      });

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

  // Update instance pending settings (song/location) before start
  public updateSettings = this.defineMethod(
    "updateSettings",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const { id, songId, locationId } = payload as {
        id: string;
        songId?: string;
        locationId?: string;
      };

      // Allow host or member to modify pending settings (optional: restrict to host)
      await this.ensureAccessForMethod("Read", socket, id);

      const patch: Prisma.InstanceUncheckedUpdateInput = {};
      if (songId) (patch as { songId?: string }).songId = songId;
      if (locationId)
        (patch as { locationId?: string }).locationId = locationId;

      const updated = await this.update(id, patch);
      if (!updated) throw new Error("Instance not found");
      // If we maintain an active record, update its snapshot and emit
      const rec = (this as unknown as { active?: Map<string, unknown> })
        .active as
        | Map<
            string,
            {
              snapshot: InstanceSnapshot;
            }
          >
        | undefined;
      if (rec && rec.has(id)) {
        const r = rec.get(id)!;
        if (songId)
          (r.snapshot as unknown as { songId?: string }).songId = songId;
        if (locationId)
          (r.snapshot as unknown as { locationId?: string }).locationId =
            locationId;
        this.emitUpdate(id, r.snapshot as unknown as Record<string, unknown>);
      }
      return this.exactResponse("updateSettings", {
        id,
        songId,
        locationId,
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
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
    if (!this.subscribers.has(entryId))
      this.subscribers.set(entryId, new Set());
    this.subscribers.get(entryId)!.add(socket);
    // Only start ticking if the instance is already Active
    if ((rec.snapshot as unknown as { status: string }).status === "Active") {
      this.startTickIfNeeded(entryId);
    }
    // Return current snapshot
    return rec.snapshot as unknown as Record<string, unknown>;
  }

  // Emit helper for instance tick/state changes
  private emitInstanceSnapshot(id: string) {
    const rec = this.active.get(id);
    if (!rec) return;
    const membersManaArr = Array.from(rec.membersMana.entries()).map(
      ([characterId, m]) => ({ characterId, ...m })
    );
    const payload = {
      ...rec.snapshot,
      membersMana: membersManaArr,
    } as unknown as Record<string, unknown>;
    this.subscribers.get(id)?.forEach((s) => {
      s.emit(`${this.serviceName}:update:${id}`, payload);
    });
    rec.subscribers.forEach((s) => {
      s.emit(`${this.serviceName}:update:${id}`, payload);
    });
    this.stopTickIfIdle(id);
  }

  private startTickIfNeeded(id: string) {
    const rec = this.active.get(id);
    if (!rec) return;
    if (rec.ticker) return;
    rec.ticker = setInterval(() => {
      // Advance mobs via helper
      const mobsAdvanced = advanceMobs(
        (
          rec.snapshot as unknown as {
            mobs: Parameters<typeof advanceMobs>[0];
          }
        ).mobs
      );
      (rec.snapshot as unknown as { mobs: typeof mobsAdvanced }).mobs =
        mobsAdvanced;

      // Contact damage against the first member if any
      const memberIds: string[] = (
        rec.snapshot as unknown as { party: { memberIds: string[] } }
      ).party.memberIds;
      if (memberIds.length > 0) {
        let anyDamage = false;
        for (const mob of mobsAdvanced) {
          if (mob.distance === 0 && mob.status === "Alive") {
            const target: string = memberIds[0];
            const mm = rec.membersMana.get(target) || {
              current: 0,
              maximum: 100,
              rate: 0,
              maxRate: 5,
              experience: 0,
            };
            const dmg = Math.max(1, Math.floor(Number(mob.damagePerHit || 1)));
            const next = { ...mm, current: Math.max(0, mm.current - dmg) };
            rec.membersMana.set(target, next);
            anyDamage = true;
          }
        }
        if (anyDamage) this.emitInstanceSnapshot(id);
      }
      this.emitInstanceSnapshot(id);
    }, 100);
  }

  private stopTickIfIdle(id: string) {
    const rec = this.active.get(id);
    if (!rec) return;
    const hasBase = (this.subscribers.get(id)?.size || 0) > 0;
    const hasLocal = rec.subscribers.size > 0;
    if (!hasBase && !hasLocal && rec.ticker) {
      clearInterval(rec.ticker);
      rec.ticker = null;
    }
  }

  // --- Stage 5: attemptBeat grading ---
  public attemptBeat = this.defineMethod(
    "attemptBeat",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const { id, characterId, clientBeatTimeMs } = payload as {
        id: string;
        characterId: string;
        clientBeatTimeMs: number;
      };

      // Ensure subscription exists (implies access) and active record is present
      if (!this.active.has(id)) {
        const exists = await (
          this.delegate as unknown as {
            findUnique: (args: {
              where: { id: string };
              select: { id: boolean };
            }) => Promise<{ id: string } | null>;
          }
        ).findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new Error("Instance not found");
        // Initialize snapshot if missing
        const inst = (await (
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
          where: { id },
          select: {
            id: true,
            partyId: true,
            songId: true,
            locationId: true,
            status: true,
            startedAt: true,
          },
        })) as {
          id: string;
          partyId: string;
          songId: string;
          locationId: string;
          status: PrismaInstance["status"];
          startedAt: Date | null;
        };
        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        const snap: InstanceSnapshot = await this.buildSnapshot(inst);
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
        this.ensureActiveRecord(id, snap);
      }
      const rec = this.active.get(id)!;

      // Grade timing window using helper
      const nowMs = Date.now();
      const { grade, rateDelta, manaDelta } = gradeBeat(
        nowMs,
        clientBeatTimeMs
      );

      // Mana adjustments based on grade
      const current = rec.membersMana.get(characterId) || {
        current: 0,
        maximum: 100,
        rate: 0,
        maxRate: 5,
        experience: 0,
      };
      const nextRate = Math.max(
        0,
        Math.min(current.maxRate, current.rate + rateDelta)
      );
      const nextCurrent = Math.max(
        0,
        Math.min(current.maximum, current.current + manaDelta)
      );
      const updated = { ...current, rate: nextRate, current: nextCurrent };
      rec.membersMana.set(characterId, updated);

      // Emit snapshot update (coalesced with tick; for now emit immediately)
      this.emitInstanceSnapshot(id);

      return this.exactResponse("attemptBeat", { grade, manaDelta, rateDelta });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  // Start the instance (Pending -> Active) and set startedAt
  public startInstance = this.defineMethod(
    "startInstance",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const id = (payload as { id: string }).id;
      const updated = await this.update(id, {
        status: "Active" as unknown as PrismaInstance["status"],
        startedAt: new Date(),
      } as Prisma.InstanceUncheckedUpdateInput);
      // Ensure active record exists for ticking
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
        where: { id },
        select: {
          id: true,
          partyId: true,
          songId: true,
          locationId: true,
          status: true,
          startedAt: true,
        },
      });
      if (inst) {
        if (!this.active.has(id)) {
          /* eslint-disable @typescript-eslint/no-unsafe-assignment */
          const snap: InstanceSnapshot = await this.buildSnapshot(inst);
          /* eslint-enable @typescript-eslint/no-unsafe-assignment */
          this.ensureActiveRecord(id, snap);
        } else {
          // Update existing in-memory snapshot to reflect Active state and startedAt
          const rec = this.active.get(id)!;
          (rec.snapshot as unknown as { status: string }).status = String(
            inst.status
          );
          (rec.snapshot as unknown as { startedAt?: Date | null }).startedAt =
            inst.startedAt ?? null;
          this.emitInstanceSnapshot(id);
        }
      }
      this.startTickIfNeeded(id);
      return this.exactResponse("startInstance", {
        id,
        status:
          (updated as unknown as { status: PrismaInstance["status"] })
            ?.status ?? "Active",
        startedAt: new Date(),
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  // Allow host or any party member to Read/Moderate the instance
  protected async evaluateEntryAccess(
    userId: string,
    entryId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin",
    _socket: CustomSocket
  ): Promise<boolean> {
    try {
      return await canAccessInstance(
        this.db as unknown as Parameters<typeof canAccessInstance>[0],
        entryId,
        userId
      );
    } catch {
      return false;
    }
  }
}
