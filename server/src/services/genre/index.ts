import BaseService from "../../core/baseService";
import type { Prisma, Genre as PrismaGenre } from "@prisma/client";
import type { GenreServiceMethods } from "@shared/types";

export default class GenreService extends BaseService<
  "genre",
  PrismaGenre,
  Prisma.GenreUncheckedCreateInput,
  Prisma.GenreUncheckedUpdateInput,
  GenreServiceMethods
> {
  constructor() {
    super({ model: "genre", hasEntryACL: false, serviceName: "genreService" });
  }

  public listAll = this.defineMethod(
    "listAll",
    "Read",
    async () => {
      const rows = await (
        this.delegate as unknown as {
          findMany: (args: { select: { id: boolean; name: boolean; description: boolean } }) => Promise<Array<Pick<PrismaGenre, "id" | "name" | "description">>>;
        }
      ).findMany({ select: { id: true, name: true, description: true } });
      return this.exactResponse("listAll", rows);
    }
  );
}


