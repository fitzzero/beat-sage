/* eslint-disable max-lines */
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

  // GameContext Integration Tests
  describe("GameContext integration scenarios", () => {
    it("handles party creation and auto-join flow like GameContext", async () => {
      const { regularAId } = await seedUsers();
      const server = await startTestServer();
      const port = server.port;
      const client = await connectAsUser(port, regularAId);

      // Create character like GameContext does
      const character = await emitWithAck<{ name: string }, { id: string }>(
        client,
        "characterService:createCharacter",
        { name: "GameContextChar" }
      );

      // Create party like GameContext.createParty does
      const party = await emitWithAck<
        { hostCharacterId: string },
        { id: string }
      >(client, "partyService:createParty", { hostCharacterId: character.id });

      expect(party.id).toBeTruthy();

      // Verify party snapshot includes the host
      const snapshot = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(client, "partyService:subscribeWithMembers", { partyId: party.id });

      expect(snapshot.hostCharacterId).toBe(character.id);
      expect(snapshot.members.length).toBe(1);
      expect(snapshot.members[0].characterId).toBe(character.id);
      expect(snapshot.members[0].isReady).toBe(false);

      client.close();
      await server.stop();
    });

    it("handles party state management like GameContext", async () => {
      const { regularAId, regularBId } = await seedUsers();
      const server = await startTestServer();
      const port = server.port;
      const clientA = await connectAsUser(port, regularAId);
      const clientB = await connectAsUser(port, regularBId);

      // Setup characters
      const charA = await emitWithAck<{ name: string }, { id: string }>(
        clientA,
        "characterService:createCharacter",
        { name: "StateCharA" }
      );
      const charB = await emitWithAck<{ name: string }, { id: string }>(
        clientB,
        "characterService:createCharacter",
        { name: "StateCharB" }
      );

      // Create party
      const party = await emitWithAck<
        { hostCharacterId: string },
        { id: string }
      >(clientA, "partyService:createParty", { hostCharacterId: charA.id });

      // Client B joins like GameContext.joinParty does
      await emitWithAck<
        { partyId: string; characterId: string },
        { id: string }
      >(clientB, "partyService:joinParty", {
        partyId: party.id,
        characterId: charB.id,
      });

      // Subscribe to party updates like GameContext does
      await emitWithAck<{ partyId: string }, unknown>(
        clientA,
        "partyService:subscribeWithMembers",
        { partyId: party.id }
      );
      await emitWithAck<{ partyId: string }, unknown>(
        clientB,
        "partyService:subscribeWithMembers",
        { partyId: party.id }
      );

      // Test ready state management like GameContext.setReady does
      await emitWithAck<
        { partyId: string; characterId: string; isReady: boolean },
        { partyId: string; characterId: string; isReady: boolean }
      >(clientB, "partyService:setReady", {
        partyId: party.id,
        characterId: charB.id,
        isReady: true,
      });

      // Verify ready state was updated
      const updatedSnapshot = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });

      const memberB = updatedSnapshot.members.find(
        (m) => m.characterId === charB.id
      );
      expect(memberB?.isReady).toBe(true);

      // Test leave party like GameContext.leaveParty does
      await emitWithAck<
        { partyId: string; characterId: string },
        { id: string }
      >(clientB, "partyService:leaveParty", {
        partyId: party.id,
        characterId: charB.id,
      });

      // Verify member was removed
      const finalSnapshot = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });

      expect(finalSnapshot.members.length).toBe(1);
      expect(finalSnapshot.members[0].characterId).toBe(charA.id);

      clientA.close();
      clientB.close();
      await server.stop();
    });

    it("handles idempotent party creation like GameContext", async () => {
      const { regularAId } = await seedUsers();
      const server = await startTestServer();
      const port = server.port;
      const client = await connectAsUser(port, regularAId);

      // Create character
      const character = await emitWithAck<{ name: string }, { id: string }>(
        client,
        "characterService:createCharacter",
        { name: "IdempotentChar" }
      );

      // Create first party
      const party1 = await emitWithAck<
        { hostCharacterId: string },
        { id: string }
      >(client, "partyService:createParty", { hostCharacterId: character.id });

      // Try to create another party with same character (should return existing)
      const party2 = await emitWithAck<
        { hostCharacterId: string },
        { id: string }
      >(client, "partyService:createParty", { hostCharacterId: character.id });

      // Should return the same party (idempotent)
      expect(party2.id).toBe(party1.id);

      client.close();
      await server.stop();
    });

    it("handles character ownership validation like GameContext", async () => {
      const { regularAId, regularBId } = await seedUsers();
      const server = await startTestServer();
      const port = server.port;
      const clientA = await connectAsUser(port, regularAId);
      const clientB = await connectAsUser(port, regularBId);

      // Client A creates character
      const charA = await emitWithAck<{ name: string }, { id: string }>(
        clientA,
        "characterService:createCharacter",
        { name: "OwnerCharA" }
      );

      // Client B tries to create party with Client A's character (should fail)
      const invalidParty = await emitWithAck<
        { hostCharacterId: string },
        { id: string } | undefined
      >(clientB, "partyService:createParty", { hostCharacterId: charA.id });

      expect(invalidParty).toBeUndefined();

      // Client B tries to join a non-existent party (should fail)
      const fakePartyId = "00000000-0000-0000-0000-000000000000";
      const invalidJoin = await emitWithAck<
        { partyId: string; characterId: string },
        { id: string } | undefined
      >(clientB, "partyService:joinParty", {
        partyId: fakePartyId,
        characterId: charA.id,
      });

      expect(invalidJoin).toBeUndefined();

      // Client A creates valid party
      const validParty = await emitWithAck<
        { hostCharacterId: string },
        { id: string }
      >(clientA, "partyService:createParty", { hostCharacterId: charA.id });

      expect(validParty.id).toBeTruthy();

      clientA.close();
      clientB.close();
      await server.stop();
    });

    it("handles real-time party updates like GameContext subscriptions", async () => {
      const { regularAId, regularBId } = await seedUsers();
      const server = await startTestServer();
      const port = server.port;
      const clientA = await connectAsUser(port, regularAId);
      const clientB = await connectAsUser(port, regularBId);

      // Setup characters
      const charA = await emitWithAck<{ name: string }, { id: string }>(
        clientA,
        "characterService:createCharacter",
        { name: "RealtimeCharA" }
      );
      const charB = await emitWithAck<{ name: string }, { id: string }>(
        clientB,
        "characterService:createCharacter",
        { name: "RealtimeCharB" }
      );

      // Create party
      const party = await emitWithAck<
        { hostCharacterId: string },
        { id: string }
      >(clientA, "partyService:createParty", { hostCharacterId: charA.id });

      // Test subscription functionality
      const snapshot1 = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });

      expect(snapshot1.members.length).toBe(1);

      // Client B joins
      await emitWithAck<
        { partyId: string; characterId: string },
        { id: string }
      >(clientB, "partyService:joinParty", {
        partyId: party.id,
        characterId: charB.id,
      });

      // Check updated state
      const snapshot2 = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });

      expect(snapshot2.members.length).toBe(2);
      expect(
        snapshot2.members.find((m) => m.characterId === charB.id)
      ).toBeTruthy();

      // Client B sets ready
      await emitWithAck<
        { partyId: string; characterId: string; isReady: boolean },
        { partyId: string; characterId: string; isReady: boolean }
      >(clientB, "partyService:setReady", {
        partyId: party.id,
        characterId: charB.id,
        isReady: true,
      });

      // Check ready state
      const snapshot3 = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });

      const memberB = snapshot3.members.find((m) => m.characterId === charB.id);
      expect(memberB?.isReady).toBe(true);

      // Client B leaves
      await emitWithAck<
        { partyId: string; characterId: string },
        { id: string }
      >(clientB, "partyService:leaveParty", {
        partyId: party.id,
        characterId: charB.id,
      });

      // Verify final state
      const finalSnapshot = await emitWithAck<
        { partyId: string },
        {
          hostCharacterId: string;
          members: Array<{ characterId: string; isReady: boolean }>;
        }
      >(clientA, "partyService:subscribeWithMembers", { partyId: party.id });

      expect(finalSnapshot.members.length).toBe(1);
      expect(finalSnapshot.members[0].characterId).toBe(charA.id);

      clientA.close();
      clientB.close();
      await server.stop();
    }, 30000); // Increased timeout
  });
});
