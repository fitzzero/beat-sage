function cryptoRandomId(): string {
  // Simple non-crypto fallback for deterministic tests; not used by DB rows
  return Math.random().toString(36).slice(2, 10);
}
import { memoryConfig } from "../../../config/memory";
import { expandQueryTerms } from "./llm";

export type SearchFilters = {
  chatId?: string;
  agentId?: string;
  userId?: string;
  type?: string;
  tags?: string[];
};

export type SearchInput = {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  includeAssociationsDepth?: number;
};

export type SearchRow = Record<string, unknown>;

export type SearchStepResult = {
  rows: SearchRow[];
  score?: number;
};

/**
 * Build Prisma where clause for lexical search (ILIKE contains on content/title and optional tags).
 */
export function buildLexicalWhere(
  query: string,
  filters?: SearchFilters
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const q = query.trim();
  if (q) {
    where["OR"] = [
      { content: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ];
  }
  const f = filters || {};
  if (f.chatId) where["chatId"] = f.chatId;
  if (f.agentId) where["agentId"] = f.agentId;
  if (f.userId) where["userId"] = f.userId;
  if (f.type) where["type"] = f.type;
  if (Array.isArray(f.tags) && f.tags.length > 0)
    where["tags"] = { hasSome: f.tags };
  return where;
}

/**
 * Merge, de-duplicate, and lightly rank rows by simple heuristics.
 */
export function rankAndDedupe(rows: SearchRow[]): SearchRow[] {
  const seen = new Set<string>();
  const unique: SearchRow[] = [];
  for (const r of rows) {
    const id = (r as { id?: string }).id || cryptoRandomId();
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(r);
  }
  // Simple ranking: newer first; pinned/importance could be added later
  unique.sort((a, b) => {
    const aRaw = (a as { updatedAt?: unknown }).updatedAt;
    const bRaw = (b as { updatedAt?: unknown }).updatedAt;
    const ad = aRaw ? new Date(aRaw as string | Date).getTime() : 0;
    const bd = bRaw ? new Date(bRaw as string | Date).getTime() : 0;
    return bd - ad;
  });
  return unique;
}

/**
 * Execute layered search: lexical, optional LLM expansion, future embeddings.
 * The `findMany` function is injected so this module remains pure/testable.
 */
export async function layeredSearch(
  input: SearchInput,
  findMany: (args: {
    where?: Record<string, unknown>;
    take?: number;
    skip?: number;
    orderBy?: Record<string, "asc" | "desc">;
  }) => Promise<SearchRow[]>
): Promise<SearchRow[]> {
  const limit = Math.min(
    Math.max(Math.floor(input.limit ?? memoryConfig.search.maxResults), 1),
    100
  );
  const offset = Math.max(Math.floor(input.offset ?? 0), 0);

  // Step 1: lexical
  const lexicalWhere = buildLexicalWhere(input.query, input.filters);
  const lexicalRows = await findMany({
    where: lexicalWhere,
    take: limit,
    skip: offset,
    orderBy: { updatedAt: "desc" },
  });

  const scored: Map<
    string,
    { row: SearchRow; score: number; updatedAt: number }
  > = new Map();
  const nowScoreLex = memoryConfig.search.lexicalWeight ?? 0.6;
  const nowScoreLLM = memoryConfig.search.llmExpansionWeight ?? 0.4;
  for (const r of lexicalRows) {
    const id = (r as { id?: string }).id || cryptoRandomId();
    const updatedAt = (r as { updatedAt?: unknown }).updatedAt
      ? new Date((r as { updatedAt: string | Date }).updatedAt).getTime()
      : 0;
    const prev = scored.get(id);
    const score = Math.max(prev?.score ?? 0, nowScoreLex);
    scored.set(id, { row: r, score, updatedAt });
  }

  // Step 2: LLM query expansion
  if (memoryConfig.llm.enabled) {
    try {
      const extraTerms = await expandQueryTerms(input.query);
      if (extraTerms.length > 0) {
        const ors: Array<Record<string, unknown>> = [];
        for (const term of extraTerms) {
          ors.push({ content: { contains: term, mode: "insensitive" } });
          ors.push({ title: { contains: term, mode: "insensitive" } });
        }
        const expandedWhere = buildLexicalWhere("", input.filters);
        expandedWhere["OR"] = ors;
        const expandedRows = await findMany({
          where: expandedWhere,
          take: limit,
          skip: offset,
          orderBy: { updatedAt: "desc" },
        });
        for (const r of expandedRows) {
          const id = (r as { id?: string }).id || cryptoRandomId();
          const updatedAt = (r as { updatedAt?: unknown }).updatedAt
            ? new Date((r as { updatedAt: string | Date }).updatedAt).getTime()
            : 0;
          const prev = scored.get(id);
          const score = Math.max(prev?.score ?? 0, nowScoreLLM);
          const row = prev?.row ?? r;
          const upd = Math.max(prev?.updatedAt ?? 0, updatedAt);
          scored.set(id, { row, score, updatedAt: upd });
        }
      }
    } catch {
      // ignore LLM failures; keep lexical
    }
  }

  // Step 3: embeddings (future)
  // if (memoryConfig.search.useEmbeddings) { ... }

  // Order by combined score desc then updatedAt desc
  const ordered = Array.from(scored.values())
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .map((v) => v.row);
  return ordered.slice(0, limit);
}
