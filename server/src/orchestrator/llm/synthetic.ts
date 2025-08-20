import type {
  Provider,
  ChatMessage,
  StreamChunk,
  StreamOptions,
} from "./Provider";

export class SyntheticProvider implements Provider {
  // Echoes a trivial response to exercise streaming without network
  async *streamChat(
    messages: ChatMessage[],
    _options: StreamOptions,
    _signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const text = lastUser?.content
      ? `You said: ${lastUser.content}`
      : "Hello from synthetic provider.";
    for (const part of text.match(/.{1,8}/g) ?? [text]) {
      // Small chunks
      yield { type: "delta", content: part } satisfies StreamChunk;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 2));
    }
    yield { type: "final", content: text } satisfies StreamChunk;
  }
}
