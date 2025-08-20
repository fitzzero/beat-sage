import type { EmitOrchestrationEvent } from "../events/types";
import { McpRegistry } from "../../mcp/registry";
import type { Provider } from "../llm/Provider";

type RunInput = {
  provider: Provider;
  modelKey: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }>;
  signal?: AbortSignal;
  emit: EmitOrchestrationEvent;
  maxOutputTokens?: number;
  // Optional MCP context; when provided, tool-phrases can trigger MCP calls
  mcp?: {
    registry: McpRegistry;
    userId: string;
    agentId?: string;
    chatId?: string;
  };
};

export async function runConversation(
  input: RunInput
): Promise<{ finalText: string; cancelled: boolean }> {
  input.emit({ type: "status", phase: "plan_start" });
  const promptText = input.messages[input.messages.length - 1]?.content || "";
  const multi = /\b(plan|steps?|tasks?)\b/i.test(promptText);
  const steps = multi
    ? ["Analyze request and outline steps", "Generate final response"]
    : ["Generate final response"];
  input.emit({ type: "status", phase: "plan_end", steps });
  input.emit({ type: "status", phase: "run_start" });
  input.emit({ type: "context", messages: input.messages.length });

  let final = "";
  let cancelled = false;
  let toolBuffer = "";
  let toolHandled = false;
  // Pre-scan: allow explicit tool directive in the latest user prompt to trigger immediately
  if (input.mcp && !toolHandled) {
    const last = input.messages[input.messages.length - 1];
    const content = last?.content || "";
    if (content.includes("[TOOL]")) {
      const match = content.match(
        new RegExp("\\[TOOL\\]\\s+([^\\s]+)\\s+({[\\s\\S]*?})")
      );
      if (match) {
        const toolName = match[1];
        const jsonStr = match[2];
        try {
          const payload: Record<string, unknown> = JSON.parse(
            jsonStr
          ) as Record<string, unknown>;
          input.emit({ type: "tool", phase: "start", toolName, payload });
          const result = await input.mcp.registry.invoke(
            toolName,
            payload,
            input.mcp.userId,
            { agentId: input.mcp.agentId, chatId: input.mcp.chatId }
          );
          input.emit({ type: "tool", phase: "result", toolName, result });
          toolHandled = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          input.emit({
            type: "tool",
            phase: "error",
            toolName,
            error: msg,
          });
          toolHandled = true;
        }
      }
    }
  }
  // Step 1
  input.emit({
    type: "step",
    index: 1,
    total: steps.length,
    title: steps[0],
    status: "start",
  });
  for await (const chunk of input.provider.streamChat(
    input.messages,
    { model: input.modelKey, maxOutputTokens: input.maxOutputTokens },
    input.signal
  )) {
    if (input.signal?.aborted) {
      cancelled = true;
      break;
    }
    if (chunk.type === "delta" && chunk.content) {
      input.emit({ type: "delta", content: chunk.content });

      // Lightweight tool-call heuristic: models output a special directive line
      // Example: [TOOL] chatService:updateTitle {"id":"...","title":"..."}
      if (input.mcp && !toolHandled) {
        toolBuffer += chunk.content;
        if (toolBuffer.includes("[TOOL]")) {
          const match = toolBuffer.match(
            new RegExp("\\[TOOL\\]\\s+([^\\s]+)\\s+({[\\s\\S]*?})")
          );
          if (match) {
            const toolName = match[1];
            const jsonStr = match[2];
            try {
              const payload: Record<string, unknown> = JSON.parse(
                jsonStr
              ) as Record<string, unknown>;
              input.emit({ type: "tool", phase: "start", toolName, payload });
              const result = await input.mcp.registry.invoke(
                toolName,
                payload,
                input.mcp.userId,
                { agentId: input.mcp.agentId, chatId: input.mcp.chatId }
              );
              input.emit({ type: "tool", phase: "result", toolName, result });
              toolHandled = true;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              input.emit({
                type: "tool",
                phase: "error",
                toolName,
                error: msg,
              });
              toolHandled = true;
            }
          }
          // Prevent unbounded growth
          if (toolBuffer.length > 5000) toolBuffer = toolBuffer.slice(-2000);
        }
      }
    }
    if (chunk.type === "final" && chunk.content) {
      final = chunk.content;
    }
  }
  input.emit({
    type: "step",
    index: 1,
    total: steps.length,
    title: steps[0],
    status: "end",
  });
  if (steps.length > 1) {
    input.emit({
      type: "step",
      index: 2,
      total: steps.length,
      title: steps[1],
      status: "start",
    });
    input.emit({
      type: "step",
      index: 2,
      total: steps.length,
      title: steps[1],
      status: "end",
    });
  }

  // Simple validator: ensure final ends with a period; if not, trigger a lightweight "repair" pass
  if (!cancelled && final && !/[.!?]$/.test(final.trim())) {
    input.emit({ type: "status", phase: "repair_start" });
    const repaired = `${final.trim()}.`;
    final = repaired;
    input.emit({ type: "status", phase: "repair_end" });
  }

  if (!cancelled) {
    input.emit({
      type: "final",
      message: { role: "assistant", content: final },
    });
  }
  input.emit({ type: "status", phase: "run_end" });
  return { finalText: final, cancelled };
}
