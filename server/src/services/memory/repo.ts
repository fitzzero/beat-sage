import type { PrismaClient } from "@prisma/client";

export class MemoryRepo {
  private db: PrismaClient;
  constructor(db: PrismaClient) {
    this.db = db;
  }

  async listRecentByUserChat(
    userId: string,
    chatId?: string | null,
    limit = 50
  ): Promise<Array<{ id: string; content: string }>> {
    return this.db.memory.findMany({
      where: { userId, chatId: chatId ?? undefined },
      select: { id: true, content: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }
}
