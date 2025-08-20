import BaseService from "../../core/baseService";
import type { Prisma, Session } from "@prisma/client";

class SessionService extends BaseService<
  "session",
  Session,
  Prisma.SessionUncheckedCreateInput,
  Prisma.SessionUncheckedUpdateInput
> {
  constructor() {
    super({
      model: "session",
      hasEntryACL: false,
      defaultACL: [],
      serviceName: "sessionService",
    });
  }

  protected checkAccess(): boolean {
    return true;
  }

  public findByToken(sessionToken: string): Promise<Session | undefined> {
    this.logger.info(`Looking up session for token ${sessionToken}`);
    return Promise.resolve(undefined);
  }

  public cleanupExpired(): Promise<number> {
    this.logger.info("Cleaning up expired sessions");
    return Promise.resolve(0);
  }
}

export default SessionService;
