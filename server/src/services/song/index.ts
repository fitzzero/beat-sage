import BaseService from "../../core/baseService";
import type { Prisma, Song as PrismaSong, SongBeat as PrismaSongBeat } from "@prisma/client";
import type { SongServiceMethods } from "@shared/types";

export default class SongService extends BaseService<
  "song",
  PrismaSong,
  Prisma.SongUncheckedCreateInput,
  Prisma.SongUncheckedUpdateInput,
  SongServiceMethods
> {
  constructor() {
    super({ model: "song", hasEntryACL: false, serviceName: "songService" });
  }

  public listSongs = this.defineMethod(
    "listSongs",
    "Read",
    async (payload) => {
      const page = Math.max(1, Math.floor((payload as { page?: number }).page ?? 1));
      const pageSizeRaw = Math.floor((payload as { pageSize?: number }).pageSize ?? 25);
      const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
      const skip = (page - 1) * pageSize;
      const genreId = (payload as { genreId?: string }).genreId;
      const where: Record<string, unknown> = {};
      if (genreId) where["genreId"] = genreId;
      const rows = await (
        this.delegate as unknown as {
          findMany: (args: {
            where?: Record<string, unknown>;
            skip?: number;
            take?: number;
            select: { id: boolean; name: boolean; genreId: boolean };
          }) => Promise<Array<Pick<PrismaSong, "id" | "name" | "genreId">>>;
        }
      ).findMany({ where, skip, take: pageSize, select: { id: true, name: true, genreId: true } });
      return this.exactResponse("listSongs", rows);
    }
  );

  public getSongBeats = this.defineMethod(
    "getSongBeats",
    "Read",
    async (payload) => {
      const songId = (payload as { songId: string }).songId;
      const rows = await (
        this.db["songBeat"] as unknown as {
          findMany: (args: { where: { songId: string }; select: { index: boolean; timeMs: boolean; direction: boolean; holdMs: boolean } }) => Promise<Array<Pick<PrismaSongBeat, "index" | "timeMs" | "direction" | "holdMs">>>;
        }
      ).findMany({
        where: { songId },
        select: { index: true, timeMs: true, direction: true, holdMs: true },
      });
      return this.exactResponse("getSongBeats", rows);
    }
  );
}


