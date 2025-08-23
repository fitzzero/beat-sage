import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("LocationService integration", () => {
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

  it("listLocations returns paginated locations", async () => {
    const { regularAId } = await seedUsers();
    await testPrisma.location.createMany({
      data: [
        { name: "Neon Arena", difficulty: 1 },
        { name: "Chrome Stage", difficulty: 2 },
      ],
    });
    const client = await connectAsUser(port, regularAId);
    const rows = await emitWithAck<
      { page?: number; pageSize?: number },
      Array<{ id: string; name: string; difficulty: number }>
    >(client, "locationService:listLocations", { page: 1, pageSize: 10 });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].name).toBeTruthy();
    client.close();
  });
});


