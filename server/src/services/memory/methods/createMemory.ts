import type MemoryService from "..";
import { normalizeContentAndSuggestTags } from "../middleware/llm";
import { memoryConfig } from "../../../config/memory";
import type { CustomSocket } from "../../../core/baseService";

export async function createMemoryHandler(
  service: MemoryService,
  payload: {
    title?: string;
    content: string;
    type?: string;
    tags?: string[];
    associatedIds?: string[];
    chatId?: string;
    agentId?: string;
  },
  socket: CustomSocket
): Promise<{ memory: Record<string, unknown> }> {
  if (!socket.userId) throw new Error("Authentication required");
  const now = new Date();

  // LLM normalization and tag suggestion (best-effort)
  let normalizedContent = payload.content;
  let extraTags: string[] = [];
  try {
    const norm = await normalizeContentAndSuggestTags(payload.content);
    normalizedContent = norm.content;
    extraTags = norm.tags;
  } catch {
    // ignore LLM failures
  }

  // Optional dedup: scan recent rows for similar content
  if (memoryConfig.dedup.enabled) {
    const recent = await (
      service["db"][service["model"]] as unknown as {
        findMany: (args: {
          where?: Record<string, unknown>;
          take?: number;
          orderBy?: Record<string, "asc" | "desc">;
        }) => Promise<Array<{ id: string; content: string }>>;
      }
    ).findMany({
      where: { userId: socket.userId, chatId: payload.chatId ?? undefined },
      take: memoryConfig.dedup.scanLimit,
      orderBy: { updatedAt: "desc" },
    });
    const sim = (a: string, b: string) => {
      const A = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
      const B = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
      const inter = Array.from(A).filter((x) => B.has(x)).length;
      const union = new Set([...Array.from(A), ...Array.from(B)]).size;
      return union === 0 ? 0 : inter / union;
    };
    let best: { id: string; score: number } | null = null;
    for (const r of recent) {
      const score = sim(normalizedContent, r.content || "");
      if (!best || score > best.score) best = { id: r.id, score };
    }
    if (best && best.score >= memoryConfig.dedup.similarityThreshold) {
      if (
        memoryConfig.dedup.mode === "link" &&
        !(payload.associatedIds || []).includes(best.id)
      ) {
        payload.associatedIds = Array.from(
          new Set([...(payload.associatedIds || []), best.id])
        );
      }
    }
  }

  const row = await service["create"]({
    userId: socket.userId,
    agentId: payload.agentId ?? null,
    chatId: payload.chatId ?? null,
    title: payload.title ?? null,
    content: normalizedContent,
    type: payload.type ?? "note",
    source: "user",
    tags: Array.from(
      new Set([
        ...(Array.isArray(payload.tags) ? payload.tags : []),
        ...extraTags,
      ])
    ),
    associatedIds: Array.isArray(payload.associatedIds)
      ? payload.associatedIds
      : [],
    importance: 0,
    pinned: false,
    lastAccessedAt: now,
    usageCount: 0,
    acl: [
      {
        userId: socket.userId,
        level: "Admin",
      },
    ],
  });
  return {
    memory: service["toDTO"](row as unknown as Record<string, unknown>, socket),
  };
}
