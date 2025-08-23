import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("SongService integration", () => {
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

  it("listSongs filters by genre and paginates; getSongBeats returns beats", async () => {
    const { regularAId } = await seedUsers();
    const uniqueName = `Electronic-${Math.random().toString(36).slice(2, 8)}`;
    const genre = await testPrisma.genre.create({ data: { name: uniqueName } });
    const song = await testPrisma.song.create({
      data: { name: "Demo Electro", genreId: genre.id, src: "/songs/demo.mp3" },
    });
    await testPrisma.songBeat.createMany({
      data: [
        { songId: song.id, index: 0, timeMs: 1000, direction: "Up" as unknown as never },
        { songId: song.id, index: 1, timeMs: 1500, direction: "Down" as unknown as never },
      ],
      skipDuplicates: true,
    });

    const client = await connectAsUser(port, regularAId);
    const songs = await emitWithAck<
      { genreId?: string; page?: number; pageSize?: number },
      Array<{ id: string; name: string; genreId: string }>
    >(client, "songService:listSongs", { genreId: genre.id, page: 1, pageSize: 10 });
    expect(songs.length).toBeGreaterThanOrEqual(1);
    expect(songs[0].genreId).toBe(genre.id);

    const beats = await emitWithAck<
      { songId: string },
      Array<{ index: number; timeMs: number; direction: string; holdMs: number }>
    >(client, "songService:getSongBeats", { songId: song.id });
    expect(beats.length).toBe(2);
    expect(beats[0].index).toBe(0);
    client.close();
  });
});


