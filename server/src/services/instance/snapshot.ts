import type { InstanceSnapshot } from "@shared/types";

export async function buildInstanceSnapshot(
  prisma: {
    instanceMob: {
      findMany: (args: { where: { instanceId: string } }) => Promise<
        Array<{
          id: string;
          instanceId: string;
          mobId: string;
          healthCurrent: number;
          status: "Alive" | "Dead";
          distance: number;
          xpPerDamage: number;
          damagePerHit: number;
        }>
      >;
    };
    partyMember: {
      findMany: (args: {
        where: { partyId: string };
        select: { characterId: boolean };
      }) => Promise<Array<{ characterId: string }>>;
    };
  },
  inst: {
    id: string;
    partyId: string;
    locationId: string;
    songId: string;
    status: string;
    startedAt: Date | null;
  }
): Promise<InstanceSnapshot> {
  const mobs = await prisma.instanceMob.findMany({
    where: { instanceId: inst.id },
  });
  const members = await prisma.partyMember.findMany({
    where: { partyId: inst.partyId },
    select: { characterId: true },
  });
  const memberIds = members.map((r) => r.characterId);
  return {
    status: inst.status as InstanceSnapshot["status"],
    startedAt: inst.startedAt,
    songId: inst.songId,
    locationId: inst.locationId,
    mobs,
    party: { memberIds },
  };
}
