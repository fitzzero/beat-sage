import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("ManaService integration", () => {
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

  it("owner can subscribe to their character's mana and receive current data", async () => {
    const { regularAId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);

    // Create a character
    const created = await emitWithAck<{ name: string }, { id: string }>(
      client,
      "characterService:createCharacter",
      { name: "ZeroMage" }
    );

    // Create mana row for this character
    await testPrisma.mana.upsert({
      where: { characterId: created.id },
      update: { current: 10, maximum: 100, rate: 1, maxRate: 5, experience: 0 },
      create: {
        characterId: created.id,
        current: 10,
        maximum: 100,
        rate: 1,
        maxRate: 5,
        experience: 0,
      },
    });

    // Subscribe to mana using characterId
    const data = await emitWithAck<{ entryId: string }, { characterId: string; current: number } | null>(
      client,
      "manaService:subscribe",
      { entryId: created.id }
    );
    expect(data && typeof data === "object").toBe(true);
    expect((data as unknown as { characterId: string }).characterId).toBe(
      created.id
    );

    client.close();
  });

  it("non-owner cannot subscribe to another user's mana", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const clientA = await connectAsUser(port, regularAId);
    const clientB = await connectAsUser(port, regularBId);

    const createdA = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "HeroA" }
    );
    await testPrisma.mana.create({ data: { characterId: createdA.id } });

    const result = await emitWithAck<{ entryId: string }, null>(
      clientB,
      "manaService:subscribe",
      { entryId: createdA.id }
    );
    // On failure, ack contains success=false, our helper returns undefined
    expect(result).toBeUndefined();

    clientA.close();
    clientB.close();
  });
});


