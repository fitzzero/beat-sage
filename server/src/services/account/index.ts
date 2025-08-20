import BaseService from "../../core/baseService";
import type { Prisma, Account } from "@prisma/client";

class AccountService extends BaseService<
  "account",
  Account,
  Prisma.AccountUncheckedCreateInput,
  Prisma.AccountUncheckedUpdateInput
> {
  constructor() {
    super({
      model: "account",
      hasEntryACL: false,
      defaultACL: [],
      serviceName: "accountService",
    });
  }

  protected checkAccess(): boolean {
    return true;
  }

  public findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<Account | undefined> {
    this.logger.info(
      `Looking up account for provider ${provider}, id ${providerAccountId}`
    );
    return Promise.resolve(undefined);
  }
}

export default AccountService;
