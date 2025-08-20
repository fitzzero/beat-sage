import baseLogger from "../utils/logger";
import type { ServiceMethodDefinition } from "../types/socket";
import type { CustomSocket } from "../core/baseService";
import { prisma } from "../db";
import { testPrisma } from "../db/testDb";
// import { mcpConfig } from "../config/mcp";

const logger = baseLogger.child({ service: "MCPRegistry" });

export type McpTool = {
  name: string; // e.g. memoryService:createMemory
  description?: string;
  // Simple open schema so we don't block on schema derivation
  parametersSchema?: Record<string, unknown>;
};

type ServiceInstance = {
  ensureAccessForMethod?: (
    requiredLevel: string,
    socket: CustomSocket,
    entryId?: string
  ) => Promise<void>;
} & Record<string, unknown>;

function discoverPublicMethods(
  serviceInstance: ServiceInstance
): ServiceMethodDefinition[] {
  const methods: ServiceMethodDefinition[] = [];
  const instanceProps = Object.getOwnPropertyNames(serviceInstance);
  const proto = Object.getPrototypeOf(serviceInstance) as object;
  const protoProps = Object.getOwnPropertyNames(proto);
  const all = [...new Set([...instanceProps, ...protoProps])];
  for (const name of all) {
    const v = (serviceInstance as Record<string, unknown>)[name];
    if (
      v &&
      typeof v === "object" &&
      (v as { name?: unknown }).name &&
      (v as { handler?: unknown }).handler
    ) {
      methods.push(v as ServiceMethodDefinition);
    }
  }
  return methods;
}

async function hydrateServiceAccess(
  userId: string
): Promise<CustomSocket["serviceAccess"]> {
  try {
    const db = process.env.NODE_ENV === "test" ? testPrisma : prisma;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { serviceAccess: true },
    });
    return ((user?.serviceAccess as unknown) ||
      {}) as CustomSocket["serviceAccess"];
  } catch {
    return {} as CustomSocket["serviceAccess"];
  }
}

export class McpRegistry {
  private services = new Map<string, ServiceInstance>();

  registerService(serviceName: string, serviceInstance: ServiceInstance) {
    this.services.set(serviceName, serviceInstance);
    logger.info(`Registered MCP service: ${serviceName}`);
  }

  listTools(): McpTool[] {
    const tools: McpTool[] = [];
    for (const [serviceName, instance] of this.services.entries()) {
      const methods = discoverPublicMethods(instance);
      for (const def of methods) {
        tools.push({
          name: `${serviceName}:${def.name}`,
          description: `Invoke ${serviceName}.${def.name}`,
          parametersSchema: { type: "object", additionalProperties: true },
        });
      }
    }
    return tools;
  }

  async invoke(
    toolName: string,
    payload: unknown,
    userId: string,
    context?: { agentId?: string; chatId?: string; traceId?: string }
  ): Promise<unknown> {
    const [serviceName, methodName] = toolName.split(":");
    const instance = this.services.get(serviceName);
    if (!instance) throw new Error(`Unknown service: ${serviceName}`);
    const methods = discoverPublicMethods(instance);
    const method = methods.find((m) => m.name === methodName);
    if (!method) throw new Error(`Unknown method: ${toolName}`);

    // Build a lightweight context compatible with CustomSocket
    const serviceAccess = await hydrateServiceAccess(userId);
    const ctx = {
      id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      serviceAccess,
      // The following fields are not used by handlers; they are added for shape-compatibility
      connected: true,
      disconnected: false,
    } as unknown as CustomSocket;

    // Agent allowlist enforcement
    if (context?.agentId) {
      const db = process.env.NODE_ENV === "test" ? testPrisma : prisma;
      const agent = await db.agent.findUnique({
        where: { id: context.agentId },
        select: { tools: true },
      });
      const enabled: string[] = Array.isArray(
        (agent?.tools as unknown as { enabled?: unknown })?.enabled
      )
        ? (
            ((agent?.tools as unknown as { enabled?: unknown })
              .enabled as unknown[]) || []
          ).filter((t): t is string => typeof t === "string")
        : [];
      if (!enabled.includes(toolName)) {
        throw new Error("Agent tool not enabled");
      }
    }

    // Enforce access similarly to ServiceRegistry
    let entryId: string | undefined;
    const resolver = (
      method as { resolveEntryId?: (p: unknown) => string | null }
    ).resolveEntryId;
    if (resolver) {
      entryId = resolver(payload) || undefined;
    } else if (
      payload &&
      typeof payload === "object" &&
      "id" in (payload as Record<string, unknown>)
    ) {
      const v = (payload as Record<string, unknown>)["id"];
      entryId = typeof v === "string" ? v : undefined;
    }

    if (typeof instance.ensureAccessForMethod === "function") {
      await instance.ensureAccessForMethod(method.access, ctx, entryId);
    }

    logger.info(`MCP invoke start: ${toolName}`, {
      category: "request_processing",
      source: "mcp",
      serviceName,
      methodName,
      userId,
      agentId: context?.agentId,
      traceId: context?.traceId,
      payload,
    });

    // Streaming: emit tool start event to chat channel if configured
    // Tool telemetry is emitted by stream orchestrators; registry avoids direct socket/io access for type safety

    const result = await method.handler(payload, ctx);

    logger.info(`MCP invoke success: ${toolName}`, {
      category: "request_processing",
      outcome: "success",
      source: "mcp",
      serviceName,
      methodName,
      userId,
      agentId: context?.agentId,
      traceId: context?.traceId,
      payload,
      result,
    });

    // See above note: leave streaming emits to orchestrators

    return result;
  }
}

// Evergreen comment: MCPRegistry mirrors ServiceRegistry's auto-discovery to expose public methods as MCP tools,
// enforcing the same access checks and forwarding a per-call user context.
