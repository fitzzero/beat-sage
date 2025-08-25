import type { InstanceSnapshot } from "@shared/types";
import type { Instance, InstanceMob } from "@prisma/client";

export async function buildInstanceSnapshot(
  prisma: {
    instanceMob: {
      findMany: (args: {
        where: { instanceId: string };
      }) => Promise<Array<InstanceMob>>;
    };
    partyMember: {
      findMany: (args: {
        where: { partyId: string };
        select: { characterId: boolean };
      }) => Promise<Array<{ characterId: string }>>;
    };
  },
  inst: Instance
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
    status: inst.status,
    startedAt: inst.startedAt,
    songId: inst.songId,
    locationId: inst.locationId,
    mobs,
    party: { memberIds },
  };
}
