export const memoryConfig = {
  chat: {
    summarizeAfterMessages: 50,
    maxContextTokens: 8000,
  },
  search: {
    maxResults: 25,
    includeAssociationsDepth: 1,
    lexicalWeight: 0.6,
    llmExpansionWeight: 0.4,
    useEmbeddings: false,
  },
  dedup: {
    enabled: true,
    mode: "link" as "warn" | "link", // default: link duplicates to nearest prior
    similarityThreshold: 0.65,
    scanLimit: 50,
  },
  llm: {
    enabled: true,
    model: "gpt-4o-mini",
    timeoutMs: 3500,
  },
} as const;

export type MemoryConfig = typeof memoryConfig;
