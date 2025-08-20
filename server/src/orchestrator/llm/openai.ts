import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type {
  Provider,
  ChatMessage,
  StreamChunk,
  StreamOptions,
} from "./Provider";

export class OpenAIProvider implements Provider {
  async *streamChat(
    messages: ChatMessage[],
    options: StreamOptions,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Map messages (filter out roles unsupported by Chat Completions, e.g., tool)
    const mapped: ChatCompletionMessageParam[] = messages
      .filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "system" | "user" | "assistant", content: m.content }));

    const stream = await client.chat.completions.create({
      model: options.model,
      messages: mapped,
      // Some models now accept max_completion_tokens instead of max_tokens
      ...(options.maxOutputTokens
        ? { max_completion_tokens: options.maxOutputTokens }
        : {}),
      stream: true,
    });

    let output = "";
    for await (const part of stream) {
      if (signal?.aborted) break;
      const delta = extractDelta(part);
      if (delta) {
        output += delta;
        yield { type: "delta", content: delta };
      }
    }

    yield { type: "final", content: output };
  }
}

function extractDelta(part: unknown): string | undefined {
  if (typeof part !== "object" || part === null) return undefined;
  const obj = part as Record<string, unknown>;
  const choices = obj["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0] as Record<string, unknown>;
  const delta = first["delta"] as Record<string, unknown> | undefined;
  const content = delta?.["content"];
  return typeof content === "string" ? content : undefined;
}
