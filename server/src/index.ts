import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import baseLogger from "./utils/logger";

const logger = baseLogger.child({ service: "Server" });
import ServiceRegistry from "./core/serviceRegistry";
import UserService from "./services/user";
import AccountService from "./services/account";
import SessionService from "./services/session";
import ModelService from "./services/model";
import AgentService from "./services/agent";
import ChatService from "./services/chat";
import CharacterService from "./services/character";
import ManaService from "./services/mana";
import SkillService from "./services/skill";
import GenreService from "./services/genre";
import SongService from "./services/song";
import LocationService from "./services/location";
import PartyService from "./services/party";
import MessageService from "./services/message";
import MemoryService from "./services/memory";
import { CustomSocket } from "./core/baseService";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize service registry
const serviceRegistry = new ServiceRegistry(io);

// Register services
const userService = new UserService();
serviceRegistry.registerService("userService", userService);
const accountService = new AccountService();
serviceRegistry.registerService("accountService", accountService);
const sessionService = new SessionService();
serviceRegistry.registerService("sessionService", sessionService);
const modelService = new ModelService();
serviceRegistry.registerService("modelService", modelService);
const agentService = new AgentService();
serviceRegistry.registerService("agentService", agentService);
const chatService = new ChatService();
serviceRegistry.registerService("chatService", chatService);
const characterService = new CharacterService();
serviceRegistry.registerService("characterService", characterService);
const manaService = new ManaService();
serviceRegistry.registerService("manaService", manaService);
const skillService = new SkillService();
serviceRegistry.registerService("skillService", skillService);
const genreService = new GenreService();
serviceRegistry.registerService("genreService", genreService);
const songService = new SongService();
serviceRegistry.registerService("songService", songService);
const locationService = new LocationService();
serviceRegistry.registerService("locationService", locationService);
const partyService = new PartyService();
serviceRegistry.registerService("partyService", partyService);
const messageService = new MessageService();
serviceRegistry.registerService("messageService", messageService);
const memoryService = new MemoryService();
serviceRegistry.registerService("memoryService", memoryService);
// Pruned non-core services per template: instrument, order, oanda, project, task

// Non-core instrument stream removed

// Basic route for health check
app.get("/", (req, res) => {
  res.send("Beat Sage Server is running");
});

// Import authentication middleware
import { authenticateSocket } from "./middleware/auth";

// Apply authentication middleware to socket connections (wrap to avoid promise-return lint)
io.use((socket, next) => {
  void authenticateSocket(socket as CustomSocket, next);
});

// Socket.io connection handler
io.on("connection", (socket) => {
  const customSocket = socket as CustomSocket;
  logger.info("Socket connected:", {
    socketId: customSocket.id,
    userId: customSocket.userId,
  });

  customSocket.on("disconnect", () => {
    logger.info("Socket disconnected:", {
      socketId: customSocket.id,
      userId: customSocket.userId,
    });
    // Cleanup subscriptions across all services for this socket
    serviceRegistry.getServiceInstances().forEach((svc) => {
      if (typeof svc.unsubscribeSocket === "function") {
        try {
          svc.unsubscribeSocket(customSocket);
        } catch {
          // ignore cleanup errors
        }
      }
    });
  });
});

const PORT = process.env.SERVER_PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(
    `Registered services: ${serviceRegistry.getServices().join(", ")}`
  );
});

// Evergreen comment: Main server with auto-service registration and Socket.io integration.
