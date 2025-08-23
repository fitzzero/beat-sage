import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("GenreService integration", () => {
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

  it("listAll returns all genres", async () => {
    const { regularAId } = await seedUsers();
    await testPrisma.genre.createMany({
      data: [
        { name: "Electronic" },
        { name: "Rock" },
      ],
      skipDuplicates: true,
    });

    const client = await connectAsUser(port, regularAId);
    const rows = await emitWithAck<Record<string, never>, Array<{ name: string }>>(
      client,
      "genreService:listAll",
      {}
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.name === "Electronic")).toBe(true);
    client.close();
  });
});


