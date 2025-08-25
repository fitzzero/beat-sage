export async function canAccessInstance(
  prisma: {
    instance: {
      findUnique: (args: {
        where: { id: string };
        select: { partyId: boolean };
      }) => Promise<{ partyId: string } | null>;
    };
    party: {
      findUnique: (args: {
        where: { id: string };
        select: { host: { select: { userId: boolean } } };
      }) => Promise<{ host: { userId: string } } | null>;
    };
    partyMember: {
      findFirst: (args: {
        where: { partyId: string; character: { userId: string } };
      }) => Promise<{ id: string } | null>;
    };
  },
  instanceId: string,
  userId: string
): Promise<boolean> {
  const inst = await prisma.instance.findUnique({
    where: { id: instanceId },
    select: { partyId: true },
  });
  if (!inst) return false;
  const host = await prisma.party.findUnique({
    where: { id: inst.partyId },
    select: { host: { select: { userId: true } } },
  });
  if (host?.host.userId === userId) return true;
  const member = await prisma.partyMember.findFirst({
    where: { partyId: inst.partyId, character: { userId } },
  });
  return !!member;
}
