import { McpRegistry } from "./registry";
import ChatService from "../services/chat";

let singleton: McpRegistry | undefined;

export function getMcpRegistry(): McpRegistry {
  if (!singleton) {
    singleton = new McpRegistry();
    // Register core service tools used by orchestrator
    singleton.registerService(
      "chatService",
      new ChatService() as unknown as Record<string, unknown>
    );
  }
  return singleton;
}
