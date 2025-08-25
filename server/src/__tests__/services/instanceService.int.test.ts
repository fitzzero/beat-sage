import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("InstanceService integration", () => {
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

  it("member can create and subscribe to instance snapshot", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const clientA = await connectAsUser(port, regularAId);
    const clientB = await connectAsUser(port, regularBId);

    // Seed content
    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song1", genreId: genre.id, src: "/songs/1.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena", difficulty: 1 },
    });

    // Create party and join
    const host = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "Host" }
    );
    const guest = await emitWithAck<{ name: string }, { id: string }>(
      clientB,
      "characterService:createCharacter",
      { name: "Guest" }
    );
    const party = await emitWithAck<
      { hostCharacterId: string },
      { id: string }
    >(clientA, "partyService:createParty", { hostCharacterId: host.id });
    await emitWithAck<{ partyId: string; characterId: string }, { id: string }>(
      clientB,
      "partyService:joinParty",
      { partyId: party.id, characterId: guest.id }
    );

    // Create instance as host
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(clientA, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });
    expect(created.id).toBeTruthy();

    // Subscribe snapshot as guest
    const snap = await emitWithAck<
      { entryId: string },
      {
        status: string;
        locationId: string;
        songId: string;
        party: { memberIds: string[] };
      } | null
    >(clientB, "instanceService:subscribe", { entryId: created.id });
    expect(snap && typeof snap === "object").toBe(true);
    if (snap) {
      expect(snap.songId).toBe(song.id);
      expect(snap.locationId).toBe(loc.id);
      expect(Array.isArray(snap.party.memberIds)).toBe(true);
      expect(snap.party.memberIds.length).toBe(2);
    }

    clientA.close();
    clientB.close();
  });
});
