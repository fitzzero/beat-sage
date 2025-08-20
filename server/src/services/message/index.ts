import BaseService from "../../core/baseService";
import { prisma } from "../../db";
import type { Message, Prisma } from "@prisma/client";
import type { MessageServiceMethods } from "@shared/types";

class MessageService extends BaseService<
  "message",
  Message,
  Prisma.MessageUncheckedCreateInput,
  Prisma.MessageUncheckedUpdateInput,
  MessageServiceMethods
> {
  constructor() {
    super({
      model: "message",
      hasEntryACL: false,
      serviceName: "messageService",
    });

    this.installAdminMethods({
      expose: {
        list: true,
        get: true,
        create: false,
        update: false,
        delete: false,
        setEntryACL: false,
        getSubscribers: true,
        reemit: true,
        unsubscribeAll: true,
      },
      access: {
        list: "Moderate",
        get: "Moderate",
        create: "Admin",
        update: "Admin",
        delete: "Admin",
        setEntryACL: "Admin",
        getSubscribers: "Admin",
        reemit: "Admin",
        unsubscribeAll: "Admin",
      },
    });
  }

  // Override to evaluate entry access by consulting chat ACLs using chatId (passed as entryId)
  protected async evaluateEntryAccess(
    userId: string,
    entryId: string,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin"
  ): Promise<boolean> {
    return this.hasChatLevel(
      userId,
      entryId,
      requiredLevel === "Public" ? "Read" : requiredLevel
    );
  }

  private async hasChatLevel(
    userId: string,
    chatId: string,
    required: "Read" | "Moderate" | "Admin"
  ): Promise<boolean> {
    const row = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { acl: true },
    });
    if (!row) return false;
    const aclList =
      (row.acl as unknown as Array<{
        userId: string;
        level: "Read" | "Moderate" | "Admin";
      }>) || [];
    const ace = aclList.find((a) => a.userId === userId);
    if (!ace) return false;
    if (required === "Read") return true;
    if (required === "Moderate")
      return ace.level === "Moderate" || ace.level === "Admin";
    if (required === "Admin") return ace.level === "Admin";
    return false;
  }

  public postMessage = this.defineMethod(
    "postMessage",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const ok = await this.hasChatLevel(socket.userId, payload.chatId, "Read");
      if (!ok) throw new Error("Insufficient permissions");
      const role = payload.role || "user";
      const created = await this.create({
        chatId: payload.chatId,
        senderUserId: role === "user" ? socket.userId : null,
        role,
        content: payload.content,
      });
      // this.create already emitted full-row update to chat subscribers; emit message lifecycle too
      this.emitUpdate(payload.chatId, { type: "created", id: created.id });
      return this.exactResponse("postMessage", { id: created.id });
    },
    { resolveEntryId: (p) => (p as { chatId: string }).chatId }
  );

  public listMessages = this.defineMethod(
    "listMessages",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const ok = await this.hasChatLevel(socket.userId, payload.chatId, "Read");
      if (!ok) throw new Error("Insufficient permissions");
      const limit = Math.min(Math.max(Math.floor(payload.limit ?? 50), 1), 200);
      const rows = await prisma.message.findMany({
        where: { chatId: payload.chatId },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          senderUser: { select: { name: true, image: true } },
          senderAgent: { select: { name: true } },
        },
      });
      return this.exactResponse(
        "listMessages",
        rows as Array<{
          id: string;
          role: string;
          content: string;
          createdAt: Date;
          senderUser?: { name?: string | null; image?: string | null } | null;
          senderAgent?: { name?: string | null } | null;
        }>
      );
    },
    { resolveEntryId: (p) => (p as { chatId: string }).chatId }
  );

  public subscribeChatMessages = this.defineMethod(
    "subscribeChatMessages",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const ok = await this.hasChatLevel(socket.userId, payload.chatId, "Read");
      if (!ok) throw new Error("Insufficient permissions");

      // Register to our internal subscriber map keyed by chatId
      if (!this.subscribers.has(payload.chatId)) {
        this.subscribers.set(payload.chatId, new Set());
      }
      this.subscribers.get(payload.chatId)!.add(socket);

      const limit = Math.min(Math.max(Math.floor(payload.limit ?? 50), 1), 200);
      const rows = await prisma.message.findMany({
        where: { chatId: payload.chatId },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          senderUser: { select: { name: true, image: true } },
          senderAgent: { select: { name: true } },
        },
      });
      return this.exactResponse(
        "subscribeChatMessages",
        rows as Array<{
          id: string;
          role: string;
          content: string;
          createdAt: Date;
          senderUser?: { name?: string | null; image?: string | null } | null;
          senderAgent?: { name?: string | null } | null;
        }>
      );
    },
    { resolveEntryId: (p) => (p as { chatId: string }).chatId }
  );

  private static activeRuns = new Map<string, AbortController>();

  public streamAssistantMessage = this.defineMethod(
    "streamAssistantMessage",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const ok = await this.hasChatLevel(
        socket.userId,
        payload.chatId,
        "Moderate"
      );
      if (!ok) throw new Error("Insufficient permissions");

      // Prevent concurrent runs per chat
      const existing = MessageService.activeRuns.get(payload.chatId);
      if (existing) {
        existing.abort();
        MessageService.activeRuns.delete(payload.chatId);
      }
      const aborter = new AbortController();
      MessageService.activeRuns.set(payload.chatId, aborter);

      // Build context
      const { buildContext } = await import(
        "../../orchestrator/prompt/buildContext"
      );
      const { runConversation } = await import(
        "../../orchestrator/runner/runConversation"
      );
      const { OpenAIProvider } = await import("../../orchestrator/llm/openai");
      const { AnthropicProvider } = await import(
        "../../orchestrator/llm/anthropic"
      );
      const { SyntheticProvider } = await import(
        "../../orchestrator/llm/synthetic"
      );

      const context = await buildContext({
        chatId: payload.chatId,
        agentId: payload.agentId ?? null,
        maxHistory: 20,
      });
      const messages = [
        ...context.messages,
        ...(payload.prompt
          ? [{ role: "user" as const, content: payload.prompt }]
          : []),
      ];

      // Choose provider/model
      const modelId = payload.modelId ?? context.modelId ?? null;
      let provider: unknown = new SyntheticProvider();
      let modelKey = "synthetic";
      if (modelId) {
        const model = await prisma.model.findUnique({
          where: { id: modelId },
          select: { provider: true, modelKey: true },
        });
        if (model) {
          modelKey = model.modelKey;
          if (model.provider.toLowerCase().includes("openai"))
            provider = new OpenAIProvider();
          else if (model.provider.toLowerCase().includes("anthropic"))
            provider = new AnthropicProvider();
        }
      }

      // Stream
      let finalText = "";
      let cancelled = false;
      try {
        const runInput: Parameters<typeof runConversation>[0] = {
          provider: provider as never,
          modelKey,
          messages,
          signal: aborter.signal,
          maxOutputTokens: 256,
          emit: (evt) => {
            if (evt.type === "delta") {
              this.emitUpdate(payload.chatId, {
                type: "delta",
                content: evt.content,
              });
            } else if (evt.type === "final") {
              finalText = evt.message.content;
            } else if (evt.type === "status") {
              this.emitUpdate(
                payload.chatId,
                evt as unknown as Record<string, unknown>
              );
            } else if (evt.type === "step") {
              this.emitUpdate(
                payload.chatId,
                evt as unknown as Record<string, unknown>
              );
            } else if (evt.type === "context") {
              this.emitUpdate(
                payload.chatId,
                evt as unknown as Record<string, unknown>
              );
            } else if (evt.type === "tool") {
              this.emitUpdate(
                payload.chatId,
                evt as unknown as Record<string, unknown>
              );
            }
          },
        };
        if (payload.agentId) {
          (runInput as unknown as { mcp: unknown }).mcp = {
            registry: (await import("../../mcp/singleton")).getMcpRegistry(),
            userId: socket.userId,
            agentId: payload.agentId,
            chatId: payload.chatId,
          } as unknown;
        }
        const result = await runConversation(runInput);
        finalText = result.finalText || finalText;
        cancelled = result.cancelled;
      } finally {
        // Clear run lock
        if (MessageService.activeRuns.get(payload.chatId) === aborter) {
          MessageService.activeRuns.delete(payload.chatId);
        }
      }

      // Persist final assistant message (skip if cancelled)
      if (cancelled) {
        this.emitUpdate(payload.chatId, { type: "status", phase: "cancelled" });
        return this.exactResponse("streamAssistantMessage", { id: "" });
      }
      const created = await this.create({
        chatId: payload.chatId,
        senderAgentId: payload.agentId ?? null,
        role: "assistant",
        content: finalText,
        modelId: modelId ?? null,
        inputTokens: (payload.prompt ?? "").length,
        outputTokens: finalText.length,
      });

      // Record usage if model is known and not synthetic
      if (modelId) {
        try {
          await prisma.model.update({
            where: { id: modelId },
            data: {
              totalRequests: { increment: 1 as unknown as bigint },
              totalInputTokens: {
                increment: (payload.prompt ?? "").length as unknown as bigint,
              },
              totalOutputTokens: {
                increment: finalText.length as unknown as bigint,
              },
              lastUsedAt: new Date(),
            },
          });
        } catch {
          // ignore usage update errors
        }
      }

      // Emit lifecycle
      this.emitUpdate(payload.chatId, { type: "created", id: created.id });
      this.emitUpdate(payload.chatId, {
        type: "final",
        message: { id: created.id, role: "assistant", content: finalText },
      });
      return this.exactResponse("streamAssistantMessage", { id: created.id });
    },
    { resolveEntryId: (p) => (p as { chatId: string }).chatId }
  );

  public cancelStream = this.defineMethod(
    "cancelStream",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const ok = await this.hasChatLevel(
        socket.userId,
        payload.chatId,
        "Moderate"
      );
      if (!ok) throw new Error("Insufficient permissions");
      const controller = MessageService.activeRuns.get(payload.chatId);
      if (controller) {
        controller.abort();
        MessageService.activeRuns.delete(payload.chatId);
        this.emitUpdate(payload.chatId, { type: "status", phase: "cancelled" });
        return this.exactResponse("cancelStream", { cancelled: true });
      }
      return this.exactResponse("cancelStream", { cancelled: false });
    },
    { resolveEntryId: (p) => (p as { chatId: string }).chatId }
  );

  // BaseService.checkAccess left as default deny; use explicit checks in methods.
}

export default MessageService;
