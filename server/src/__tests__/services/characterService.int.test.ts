import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import type { StartedServer } from "../utils/socket";

describe("CharacterService integration", () => {
  let server: StartedServer;
  let port: number;
  let stop: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    server = await startTestServer();
    port = server.port;
    stop = server.stop;
  });

  afterAll(async () => {
    if (stop) await stop();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("regular user can create and update their own character", async () => {
    const { regularAId } = await seedUsers();
    const client = await connectAsUser(port, regularAId);
    const created = await emitWithAck<{ name: string }, { id: string }>(
      client,
      "characterService:createCharacter",
      { name: "HeroA" }
    );
    expect(created.id).toBeTruthy();

    const updated = await emitWithAck<
      { id: string; patch: { online?: boolean; name?: string } },
      { id: string; name: string; online: boolean } | undefined
    >(client, "characterService:updateCharacter", {
      id: created.id,
      patch: { online: true, name: "HeroA+" },
    });
    expect(updated?.name).toBe("HeroA+");
    expect(updated?.online).toBe(true);
    client.close();
  });

  it("regular user cannot update someone else's character", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const clientA = await connectAsUser(port, regularAId);
    const created = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "HeroA" }
    );
    clientA.close();

    const clientB = await connectAsUser(port, regularBId);
    const attempt = await emitWithAck<
      { id: string; patch: { online?: boolean; name?: string } },
      { id: string; name: string; online: boolean } | undefined
    >(clientB, "characterService:updateCharacter", {
      id: created.id,
      patch: { name: "Hacker" },
    });
    expect(attempt).toBeUndefined();
    clientB.close();
  });
});
