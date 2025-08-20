export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type StreamChunk = {
  type: "delta" | "final";
  content?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type StreamOptions = {
  model: string;
  maxOutputTokens?: number;
};

export type Provider = {
  streamChat(
    messages: ChatMessage[],
    options: StreamOptions,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk>;
};
