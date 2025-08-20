import BaseService from "../../core/baseService";
import type { Prisma, User as PrismaUser } from "@prisma/client";
import type { UserServiceMethods } from "@shared/types";
import type { CustomSocket } from "../../core/baseService";
import { updateUserHandler } from "./methods/updateUser";

class UserService extends BaseService<
  "user",
  PrismaUser,
  Prisma.UserUncheckedCreateInput,
  Prisma.UserUncheckedUpdateInput,
  UserServiceMethods
> {
  constructor() {
    super({
      model: "user",
      hasEntryACL: true,
      defaultACL: [],
      serviceName: "userService",
    });

    this.installAdminMethods({
      expose: {
        list: true,
        get: true,
        create: false,
        update: true,
        delete: false,
        setEntryACL: this.hasEntryACL,
        getSubscribers: true,
        reemit: true,
        unsubscribeAll: true,
      },
      access: {
        list: "Moderate",
        get: "Moderate",
        create: "Admin",
        update: "Moderate",
        delete: "Admin",
        setEntryACL: "Admin",
        getSubscribers: "Admin",
        reemit: "Admin",
        unsubscribeAll: "Admin",
      },
    });
  }

  public updateUser = this.defineMethod(
    "updateUser",
    "Moderate",
    (payload, socket) => updateUserHandler(this, payload, socket),
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  protected checkAccess(
    userId: string | undefined,
    entryId: string,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin",
    socket?: CustomSocket
  ): boolean {
    if (!userId) return false;
    if (userId === entryId) return true;
    const level = socket?.serviceAccess?.["userService"];
    const hasServiceAccess = level
      ? this.isAccessLevelSufficient(level, requiredLevel)
      : false;
    this.logger.debug(
      `Access check: user ${userId} on entry ${entryId} for ${requiredLevel}`,
      { hasServiceAccess, isSelfAccess: userId === entryId }
    );
    return hasServiceAccess;
  }
}

export default UserService;
