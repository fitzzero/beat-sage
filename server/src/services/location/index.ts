import BaseService from "../../core/baseService";
import type { Prisma, Location as PrismaLocation } from "@prisma/client";
import type { LocationServiceMethods } from "@shared/types";

export default class LocationService extends BaseService<
  "location",
  PrismaLocation,
  Prisma.LocationUncheckedCreateInput,
  Prisma.LocationUncheckedUpdateInput,
  LocationServiceMethods
> {
  constructor() {
    super({
      model: "location",
      hasEntryACL: false,
      serviceName: "locationService",
    });
  }

  public listLocations = this.defineMethod(
    "listLocations",
    "Read",
    async (payload) => {
      const page = Math.max(
        1,
        Math.floor((payload as { page?: number }).page ?? 1)
      );
      const pageSizeRaw = Math.floor(
        (payload as { pageSize?: number }).pageSize ?? 25
      );
      const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
      const skip = (page - 1) * pageSize;
      const rows = await (
        this.delegate as unknown as {
          findMany: (args: {
            skip?: number;
            take?: number;
            select: { id: boolean; name: boolean; difficulty: boolean };
          }) => Promise<
            Array<Pick<PrismaLocation, "id" | "name" | "difficulty">>
          >;
        }
      ).findMany({
        skip,
        take: pageSize,
        select: { id: true, name: true, difficulty: true },
      });
      return this.exactResponse("listLocations", rows);
    }
  );
}
