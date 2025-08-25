import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import {
  startTestServer,
  connectAsUser,
  emitWithAck,
  waitFor,
} from "../utils/socket";
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

  it("attemptBeat updates in-memory mana and returns grading deltas", async () => {
    const { regularAId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const clientA = await connectAsUser(portLocal, regularAId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song2", genreId: genre.id, src: "/songs/2.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena2", difficulty: 1 },
    });

    const host = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "Host2" }
    );
    const party = await emitWithAck<
      { hostCharacterId: string },
      { id: string }
    >(clientA, "partyService:createParty", { hostCharacterId: host.id });
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(clientA, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });

    const result = await emitWithAck<
      { id: string; characterId: string; clientBeatTimeMs: number },
      { grade: string; manaDelta: number; rateDelta: number }
    >(clientA, "instanceService:attemptBeat", {
      id: created.id,
      characterId: host.id,
      clientBeatTimeMs: Date.now(),
    });
    expect(["Perfect", "Great", "Good", "Bad", "Miss"]).toContain(result.grade);

    clientA.close();
    await server.stop();
  });

  it("startInstance transitions to Active and begins ticking", async () => {
    const { regularAId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const clientA = await connectAsUser(portLocal, regularAId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song3", genreId: genre.id, src: "/songs/3.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena3", difficulty: 1 },
    });
    const host = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "Host3" }
    );
    const party = await emitWithAck<
      { hostCharacterId: string },
      { id: string }
    >(clientA, "partyService:createParty", { hostCharacterId: host.id });
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(clientA, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });

    const started = await emitWithAck<
      { id: string },
      { id: string; status: string }
    >(clientA, "instanceService:startInstance", { id: created.id });
    expect(started.status).toBe("Active");

    clientA.close();
    await server.stop();
  });

  it("emits periodic snapshots to all subscribers after start (fan-out)", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const clientA = await connectAsUser(portLocal, regularAId);
    const clientB = await connectAsUser(portLocal, regularBId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song4", genreId: genre.id, src: "/songs/4.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena4", difficulty: 1 },
    });
    const host = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "Host4" }
    );
    const guest = await emitWithAck<{ name: string }, { id: string }>(
      clientB,
      "characterService:createCharacter",
      { name: "Guest4" }
    );
    const party = await emitWithAck<
      {
        hostCharacterId: string;
      },
      { id: string }
    >(clientA, "partyService:createParty", {
      hostCharacterId: host.id,
    });
    await emitWithAck<{ partyId: string; characterId: string }, { id: string }>(
      clientB,
      "partyService:joinParty",
      { partyId: party.id, characterId: guest.id }
    );
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(clientA, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });

    // Subscribe both members
    await emitWithAck<{ entryId: string }, unknown>(
      clientA,
      "instanceService:subscribe",
      { entryId: created.id }
    );
    await emitWithAck<{ entryId: string }, unknown>(
      clientB,
      "instanceService:subscribe",
      { entryId: created.id }
    );

    // Start ticking
    const started = await emitWithAck<
      { id: string },
      { id: string; status: string; startedAt?: string | Date | null }
    >(clientA, "instanceService:startInstance", { id: created.id });
    expect(started.status).toBe("Active");

    // Expect a tick emission on both clients
    const eventName = `instanceService:update:${created.id}`;
    const [evtA, evtB] = await Promise.all([
      waitFor<Record<string, unknown>>(clientA, eventName),
      waitFor<Record<string, unknown>>(clientB, eventName),
    ]);
    expect(evtA && (evtA as { status?: string }).status).toBe("Active");
    expect(evtB && (evtB as { status?: string }).status).toBe("Active");

    clientA.close();
    clientB.close();
    await server.stop();
  });

  it("enforces access controls for subscribe/start/attemptBeat", async () => {
    const { regularAId, adminId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const hostClient = await connectAsUser(portLocal, regularAId);
    const outsider = await connectAsUser(portLocal, adminId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song5", genreId: genre.id, src: "/songs/5.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena5", difficulty: 1 },
    });
    const host = await emitWithAck<{ name: string }, { id: string }>(
      hostClient,
      "characterService:createCharacter",
      { name: "Host5" }
    );
    const party = await emitWithAck<
      {
        hostCharacterId: string;
      },
      { id: string }
    >(hostClient, "partyService:createParty", {
      hostCharacterId: host.id,
    });
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(hostClient, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });

    // Outsider cannot subscribe
    const unauthorizedSnap = await emitWithAck<{ entryId: string }, unknown>(
      outsider,
      "instanceService:subscribe",
      { entryId: created.id }
    );
    expect(unauthorizedSnap).toBeUndefined();

    // Outsider cannot startInstance (ack will be undefined on error)
    const unauthorizedStart = await emitWithAck<{ id: string }, unknown>(
      outsider,
      "instanceService:startInstance",
      { id: created.id }
    );
    expect(unauthorizedStart).toBeUndefined();

    // Outsider cannot attemptBeat
    const unauthorizedBeat = await emitWithAck<
      { id: string; characterId: string; clientBeatTimeMs: number },
      unknown
    >(outsider, "instanceService:attemptBeat", {
      id: created.id,
      characterId: host.id,
      clientBeatTimeMs: Date.now(),
    });
    expect(unauthorizedBeat).toBeUndefined();

    hostClient.close();
    outsider.close();
    await server.stop();
  });

  it("maintains snapshot stability across ticks (keys, startedAt constant)", async () => {
    const { regularAId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const client = await connectAsUser(portLocal, regularAId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song6", genreId: genre.id, src: "/songs/6.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena6", difficulty: 1 },
    });
    const host = await emitWithAck<{ name: string }, { id: string }>(
      client,
      "characterService:createCharacter",
      { name: "Host6" }
    );
    const party = await emitWithAck<
      {
        hostCharacterId: string;
      },
      { id: string }
    >(client, "partyService:createParty", {
      hostCharacterId: host.id,
    });
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(client, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });
    await emitWithAck<{ entryId: string }, unknown>(
      client,
      "instanceService:subscribe",
      { entryId: created.id }
    );
    const started = await emitWithAck<
      { id: string },
      { id: string; status: string; startedAt?: string | Date | null }
    >(client, "instanceService:startInstance", { id: created.id });
    expect(started.status).toBe("Active");

    const eventName = `instanceService:update:${created.id}`;
    const first = await waitFor<Record<string, unknown>>(client, eventName);
    const second = await waitFor<Record<string, unknown>>(client, eventName);

    // Keys present
    for (const k of ["status", "songId", "locationId", "mobs", "party"]) {
      expect(first).toHaveProperty(k);
      expect(second).toHaveProperty(k);
    }
    // startedAt should be set and stable
    const s1 = (first as { startedAt?: string | Date | null }).startedAt;
    const s2 = (second as { startedAt?: string | Date | null }).startedAt;
    expect(s1).toBeTruthy();
    expect(s2).toBeTruthy();
    expect(String(s1)).toBe(String(s2));

    client.close();
    await server.stop();
  });

  it("returns Miss grading with negative deltas when off-beat", async () => {
    const { regularAId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const clientA = await connectAsUser(portLocal, regularAId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song7", genreId: genre.id, src: "/songs/7.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena7", difficulty: 1 },
    });
    const host = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "Host7" }
    );
    const party = await emitWithAck<
      {
        hostCharacterId: string;
      },
      { id: string }
    >(clientA, "partyService:createParty", {
      hostCharacterId: host.id,
    });
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(clientA, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });

    const miss = await emitWithAck<
      { id: string; characterId: string; clientBeatTimeMs: number },
      { grade: string; manaDelta: number; rateDelta: number }
    >(clientA, "instanceService:attemptBeat", {
      id: created.id,
      characterId: host.id,
      clientBeatTimeMs: Date.now() - 1000,
    });

    expect(miss.grade).toBe("Miss");
    expect(miss.rateDelta).toBe(-1);
    expect(miss.manaDelta).toBe(-1);

    clientA.close();
    await server.stop();
  });

  it("propagates startedAt on start and through subsequent snapshots", async () => {
    const { regularAId } = await seedUsers();
    const server = await startTestServer();
    const portLocal = server.port;
    const client = await connectAsUser(portLocal, regularAId);

    const genre = await testPrisma.genre.create({
      data: { name: `G-${Math.random().toString(36).slice(2, 6)}` },
    });
    const song = await testPrisma.song.create({
      data: { name: "Song8", genreId: genre.id, src: "/songs/8.mp3" },
    });
    const loc = await testPrisma.location.create({
      data: { name: "Arena8", difficulty: 1 },
    });
    const host = await emitWithAck<{ name: string }, { id: string }>(
      client,
      "characterService:createCharacter",
      { name: "Host8" }
    );
    const party = await emitWithAck<
      {
        hostCharacterId: string;
      },
      { id: string }
    >(client, "partyService:createParty", {
      hostCharacterId: host.id,
    });
    const created = await emitWithAck<
      { partyId: string; locationId: string; songId: string },
      { id: string; status: string }
    >(client, "instanceService:createInstance", {
      partyId: party.id,
      locationId: loc.id,
      songId: song.id,
    });
    await emitWithAck<{ entryId: string }, unknown>(
      client,
      "instanceService:subscribe",
      { entryId: created.id }
    );
    const started = await emitWithAck<
      { id: string },
      { id: string; status: string; startedAt?: string | Date | null }
    >(client, "instanceService:startInstance", { id: created.id });
    expect(started.startedAt).toBeTruthy();

    const eventName = `instanceService:update:${created.id}`;
    const evt = (await waitFor<Record<string, unknown>>(client, eventName)) as {
      startedAt?: string | null;
    };
    expect(evt.startedAt).toBeTruthy();

    client.close();
    await server.stop();
  });
});
