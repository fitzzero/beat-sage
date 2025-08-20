import { Anthropic } from "@anthropic-ai/sdk";
import type {
  Provider,
  ChatMessage,
  StreamChunk,
  StreamOptions,
} from "./Provider";

export class AnthropicProvider implements Provider {
  async *streamChat(
    messages: ChatMessage[],
    options: StreamOptions,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Anthropic expects a system message + alternating user/assistant turns.
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const contentTurns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const stream = client.messages.stream({
      model: options.model,
      system: systemMsg,
      max_tokens: options.maxOutputTokens ?? 256,
      messages: contentTurns,
    });

    let output = "";
    for await (const event of stream as AsyncIterable<unknown>) {
      if (signal?.aborted) break;
      const delta = extractAnthropicDelta(event);
      if (delta) {
        output += delta;
        yield { type: "delta", content: delta } satisfies StreamChunk;
      }
    }

    yield { type: "final", content: output } satisfies StreamChunk;
  }
}

function extractAnthropicDelta(event: unknown): string | undefined {
  if (typeof event !== "object" || event === null) return undefined;
  const obj = event as Record<string, unknown>;
  const maybeDelta = obj["delta"] as Record<string, unknown> | undefined;
  const text = maybeDelta?.["text"];
  return typeof text === "string" ? text : undefined;
}
