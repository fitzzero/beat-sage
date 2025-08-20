import OpenAI from "openai";
import { memoryConfig } from "../../../config/memory";

/**
 * Expand query with synonyms/related terms using a small LLM.
 * Returns an empty array on error/timeout or when disabled by config.
 */
export async function expandQueryTerms(
  query: string,
  options?: { timeoutMs?: number }
): Promise<string[]> {
  if (process.env.NODE_ENV === "test") return [];
  if (!memoryConfig.llm.enabled) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const timeoutMs = options?.timeoutMs ?? memoryConfig.llm.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    const client = new OpenAI({ apiKey });
    const prompt =
      `You are a helpful assistant that expands short search queries into a few concise related terms.\n` +
      `Return a plain JSON array of 3-8 strings. Avoid long phrases.\n` +
      `Query: ${query}`;

    const completion = await client.chat.completions.create(
      {
        model: memoryConfig.llm.model,
        messages: [
          { role: "system", content: "Return only JSON. No preface." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      },
      { signal: controller.signal }
    );

    const text = completion.choices?.[0]?.message?.content || "[]";
    let arr: unknown;
    try {
      arr = JSON.parse(text);
    } catch {
      // fallback: try to split by comma if model didn't follow JSON strictly
      arr = String(text)
        .replace(/\[|\]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const items = Array.isArray(arr)
      ? arr
      : Array.isArray((arr as { terms?: unknown[] })?.terms)
      ? ((arr as { terms?: unknown[] }).terms as unknown[])
      : [];
    const terms = items
      .filter((x: unknown) => typeof x === "string")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const base = query.toLowerCase();
    const dedup = Array.from(
      new Set(terms.filter((t) => t.toLowerCase() !== base))
    );
    // Bound results
    return dedup.slice(0, 12);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize content and suggest tags using LLM; falls back to passthrough on error or when disabled.
 */
export async function normalizeContentAndSuggestTags(
  content: string,
  options?: { timeoutMs?: number }
): Promise<{ content: string; tags: string[] }> {
  if (process.env.NODE_ENV === "test") return { content, tags: [] };
  if (!memoryConfig.llm.enabled) return { content, tags: [] };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { content, tags: [] };

  const timeoutMs = options?.timeoutMs ?? memoryConfig.llm.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    const client = new OpenAI({ apiKey });
    const prompt =
      `Clean up the following note into a concise sentence or two, removing filler and typos. Also suggest 3-8 short tags.\n` +
      `Return strict JSON: {"content": string, "tags": string[]}\n` +
      `Note: ${content}`;
    const completion = await client.chat.completions.create(
      {
        model: memoryConfig.llm.model,
        messages: [
          {
            role: "system",
            content: "Return only strict JSON matching the schema.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      },
      { signal: controller.signal }
    );
    const text = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text) as { content?: string; tags?: unknown[] };
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === "string")
      : [];
    const cleaned =
      typeof parsed.content === "string" && parsed.content.trim().length > 0
        ? parsed.content.trim()
        : content;
    return { content: cleaned, tags };
  } catch {
    return { content, tags: [] };
  } finally {
    clearTimeout(timer);
  }
}
