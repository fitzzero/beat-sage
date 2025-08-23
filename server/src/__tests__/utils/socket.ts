import http from "http";
import express from "express";
import { Server } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import ServiceRegistry from "../../core/serviceRegistry";
import UserService from "../../services/user";
import ModelService from "../../services/model";
import AgentService from "../../services/agent";
import ChatService from "../../services/chat";
import MessageService from "../../services/message";
import MemoryService from "../../services/memory";
import CharacterService from "../../services/character";
// Pruned non-core services for Beat Sage
import { authenticateSocket } from "../../middleware/auth";

export type StartedServer = {
  httpServer: http.Server;
  io: Server;
  port: number;
  stop: () => Promise<void>;
  serviceRegistry: ServiceRegistry;
  userService: UserService;
  modelService: ModelService;
  agentService: AgentService;
  chatService: ChatService;
  messageService: MessageService;
  memoryService: MemoryService;
  // pruned services removed from return type
};

export async function startTestServer(overrides?: {
  defaultACL?: Array<{ userId: string; level: "Read" | "Moderate" | "Admin" }>;
}): Promise<StartedServer> {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });
  // Silence MaxListenersExceededWarning in tests
  io.setMaxListeners(0);

  // Auth middleware
  io.use((socket, next) => {
    void authenticateSocket(socket as never, next);
  });

  // Register services
  const serviceRegistry = new ServiceRegistry(io);
  const userService = new UserService();
  if (overrides?.defaultACL) {
    // Patch instance default ACL for testing
    (
      userService as unknown as {
        defaultACL: Array<{
          userId: string;
          level: "Read" | "Moderate" | "Admin";
        }>;
      }
    ).defaultACL = overrides.defaultACL;
  }
  serviceRegistry.registerService("userService", userService);
  const modelService = new ModelService();
  serviceRegistry.registerService("modelService", modelService);
  const agentService = new AgentService();
  serviceRegistry.registerService("agentService", agentService);
  const chatService = new ChatService();
  serviceRegistry.registerService("chatService", chatService);
  const messageService = new MessageService();
  serviceRegistry.registerService("messageService", messageService);
  const memoryService = new MemoryService();
  serviceRegistry.registerService("memoryService", memoryService);
  const characterService = new CharacterService();
  serviceRegistry.registerService("characterService", characterService);
  // pruned service registrations

  // Pick an ephemeral port
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const stop = async () => {
    await new Promise<void>((resolve) => {
      void io.close(() => {
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      void httpServer.close(() => {
        resolve();
      });
    });
  };

  return {
    httpServer,
    io,
    port,
    stop,
    serviceRegistry,
    userService,
    modelService,
    agentService,
    chatService,
    messageService,
    memoryService,
    // character service is registered but not exposed here
  };
}

export async function connectAsUser(
  port: number,
  userId: string
): Promise<ClientSocket> {
  const url = `http://localhost:${port}`;
  // Use dev credentials path if enabled; otherwise the server will fallback to cookie/JWT
  const auth: Record<string, unknown> = {};
  if (process.env.ENABLE_DEV_CREDENTIALS === "true") {
    auth.userId = userId;
  }
  const client = ioClient(url, {
    auth,
    timeout: 10000,
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", (err) => reject(err));
  });
  return client;
}

export function emitWithAck<TPayload, TResponse = unknown>(
  client: ClientSocket,
  event: string,
  payload: TPayload
): Promise<TResponse> {
  return new Promise((resolve) => {
    client.emit(
      event,
      payload,
      (response: { success: boolean; data?: TResponse }) => {
        resolve(
          (response?.data as TResponse) ?? (undefined as unknown as TResponse)
        );
      }
    );
  });
}

export function waitFor<T = unknown>(client: ClientSocket, event: string) {
  return new Promise<T>((resolve) => {
    client.once(event, (data: T) => resolve(data));
  });
}
