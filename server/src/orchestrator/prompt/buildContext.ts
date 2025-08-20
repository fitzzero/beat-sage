import { prisma } from "../../db";
import type { ChatMessage } from "../llm/Provider";

type BuildContextInput = {
  chatId: string;
  agentId?: string | null;
  maxHistory?: number;
};

export async function buildContext(
  input: BuildContextInput
): Promise<{ messages: ChatMessage[]; modelId?: string | null }> {
  const chat = await prisma.chat.findUnique({
    where: { id: input.chatId },
    select: { systemPrompt: true, agentId: true },
  });
  const agentId = input.agentId ?? chat?.agentId ?? null;
  const agent = agentId
    ? await prisma.agent.findUnique({
        where: { id: agentId },
        select: { instructions: true, defaultModelId: true, tools: true },
      })
    : null;

  const limit = Math.min(Math.max(Math.floor(input.maxHistory ?? 20), 1), 200);
  const history = await prisma.message.findMany({
    where: { chatId: input.chatId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { role: true, content: true },
  });

  const messages: ChatMessage[] = [];
  const sys = chat?.systemPrompt || agent?.instructions || undefined;
  if (sys) messages.push({ role: "system", content: sys });
  for (const m of history) {
    const role = (m.role as "user" | "assistant" | "system" | "tool") || "user";
    // Skip system in history; already included
    if (role === "system") continue;
    messages.push({ role, content: m.content });
  }

  // Tool context (enabled tools only)
  if (agent?.tools) {
    const enabled = Array.isArray(
      (agent.tools as unknown as { enabled?: unknown })?.enabled
    )
      ? (
          ((agent.tools as unknown as { enabled?: unknown }).enabled ||
            []) as unknown[]
        ).filter((t): t is string => typeof t === "string")
      : [];
    if (enabled.length > 0) {
      let toolsLines: string[] = [];
      try {
        // Attempt to import generated tool specs for richer context
        // Path: monorepoRoot/shared/generated/tools.ts
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - dynamic import path outside workspace
        const mod = (await import("../../../../shared/generated/tools")) as {
          ALL_TOOLS?: Array<{
            name: string;
            service: string;
            method: string;
            access: string;
          }>;
        };
        const ALL_TOOLS = Array.isArray(mod?.ALL_TOOLS) ? mod.ALL_TOOLS : [];
        const specs = ALL_TOOLS.filter((t) => enabled.includes(t.name));
        if (specs.length > 0) {
          toolsLines = specs.map((t) => `- ${t.name} (access: ${t.access})`);
        }
      } catch {
        // Fallback: just list names
        toolsLines = enabled.map((n) => `- ${n}`);
      }
      if (toolsLines.length > 0) {
        const instruction =
          `You can use the following tools when appropriate. ` +
          `When you decide to call a tool, output exactly one line in this format so the system can execute it: ` +
          `[TOOL] service:method {JSON payload}` +
          `\nAvailable tools (enabled for this agent):\n` +
          toolsLines.join("\n");
        messages.unshift({ role: "system", content: instruction });
      }
    }
  }

  // Heuristic budget: keep last ~3 turns if messages are long
  const joinedLen = messages.reduce((n, m) => n + m.content.length, 0);
  if (joinedLen > 6000 && messages.length > 8) {
    // keep system + last 6 messages
    const sys = messages[0]?.role === "system" ? [messages[0]] : [];
    const tail = messages.slice(-6);
    return {
      messages: [...sys, ...tail],
      modelId: agent?.defaultModelId ?? null,
    };
  }

  return { messages, modelId: agent?.defaultModelId ?? null };
}
