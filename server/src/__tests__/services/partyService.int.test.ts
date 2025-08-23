import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("PartyService integration", () => {
  let port: number;
  let stop: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const server = await startTestServer();
    port = server.port;
    stop = server.stop;
  });

  afterAll(async () => {
    if (stop) await stop();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("host can create, users can join/leave, setReady, and subscribeWithMembers returns snapshot", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const clientA = await connectAsUser(port, regularAId);
    const clientB = await connectAsUser(port, regularBId);

    const host = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "HostChar" }
    );
    const other = await emitWithAck<{ name: string }, { id: string }>(
      clientB,
      "characterService:createCharacter",
      { name: "GuestChar" }
    );

    const party = await emitWithAck<
      { hostCharacterId: string },
      { id: string }
    >(clientA, "partyService:createParty", { hostCharacterId: host.id });

    // Join as B
    await emitWithAck<{ partyId: string; characterId: string }, { id: string }>(
      clientB,
      "partyService:joinParty",
      { partyId: party.id, characterId: other.id }
    );

    // Ensure membership is committed
    for (let i = 0; i < 10; i++) {
      const members = await testPrisma.partyMember.findMany({
        where: { partyId: party.id },
        select: { characterId: true },
      });
      const hasOther = members.some((m) => m.characterId === other.id);
      if (hasOther) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 10));
    }

    // Give DB a tick, then subscribe snapshot
    await new Promise((r) => setTimeout(r, 10));

    const snap1 = await emitWithAck<
      { partyId: string },
      {
        hostCharacterId: string;
        members: Array<{ characterId: string; isReady: boolean }>;
      }
    >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });
    expect(snap1.hostCharacterId).toBe(host.id);
    expect(snap1.members.find((m) => m.characterId === host.id)).toBeTruthy();
    expect(snap1.members.find((m) => m.characterId === other.id)).toBeTruthy();

    // Set ready for other
    const set = await emitWithAck<
      { partyId: string; characterId: string; isReady: boolean },
      { partyId: string; characterId: string; isReady: boolean }
    >(clientB, "partyService:setReady", {
      partyId: party.id,
      characterId: other.id,
      isReady: true,
    });
    expect(set.isReady).toBe(true);

    // Leave party
    await emitWithAck<{ partyId: string; characterId: string }, { id: string }>(
      clientB,
      "partyService:leaveParty",
      { partyId: party.id, characterId: other.id }
    );
    const snap2 = await emitWithAck<
      { partyId: string },
      {
        hostCharacterId: string;
        members: Array<{ characterId: string; isReady: boolean }>;
      }
    >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });
    expect(
      snap2.members.find((m) => m.characterId === other.id)
    ).toBeUndefined();

    clientA.close();
    clientB.close();
  });
});
