import { Server } from "socket.io";
import { ServiceResponse, ServiceMethodDefinition } from "../types/socket";
import { CustomSocket } from "./baseService";
import logger from "../utils/logger";
import { PrismaClient } from "@prisma/client";

class ServiceRegistry {
  private io: Server;
  private services: Map<string, unknown> = new Map();
  private logger = logger.child({ service: this.constructor.name });
  private prisma: PrismaClient;

  // Default service access permissions for new users
  private defaultServiceAccess: Record<string, "Read" | "Moderate" | "Admin"> =
    {
      partyService: "Read",
      characterService: "Read",
      songService: "Read",
      locationService: "Read",
      instanceService: "Read",
      messageService: "Read",
      memoryService: "Read",
      userService: "Read",
      modelService: "Read",
      agentService: "Read",
      genreService: "Read",
      manaService: "Read",
      skillService: "Read",
    };

  constructor(io: Server) {
    this.io = io;
    this.prisma = new PrismaClient();
  }

  // Ensure user has default service access permissions
  private async ensureDefaultServiceAccess(
    socket: CustomSocket
  ): Promise<void> {
    if (!socket.userId) return;

    try {
      // Get current user service access
      const user = await this.prisma.user.findUnique({
        where: { id: socket.userId },
        select: { serviceAccess: true },
      });

      if (!user) {
        this.logger.warn(
          `User ${socket.userId} not found during service access check`
        );
        return;
      }

      const currentAccess =
        (user.serviceAccess as Record<string, "Read" | "Moderate" | "Admin">) ||
        {};
      const updatedAccess: Record<string, "Read" | "Moderate" | "Admin"> = {
        ...currentAccess,
      };
      let hasChanges = false;

      // Add any missing default permissions
      for (const [serviceName, defaultLevel] of Object.entries(
        this.defaultServiceAccess
      )) {
        if (!updatedAccess[serviceName]) {
          updatedAccess[serviceName] = defaultLevel;
          hasChanges = true;
          this.logger.info(
            `Adding default ${defaultLevel} access for ${serviceName} to user ${socket.userId}`
          );
        }
      }

      // Update database if changes were made
      if (hasChanges) {
        await this.prisma.user.update({
          where: { id: socket.userId },
          data: { serviceAccess: updatedAccess },
        });
        this.logger.info(`Updated service access for user ${socket.userId}`);
      }

      // Load service access into socket for BaseService access checks
      socket.serviceAccess = updatedAccess;
      this.logger.debug(`Loaded service access for user ${socket.userId}`, {
        serviceAccess: updatedAccess,
      });
    } catch (error) {
      this.logger.error(
        `Error ensuring default service access for user ${socket.userId}:`,
        error
      );
      // Don't throw - we don't want to break authentication
    }
  }

  // Register a service instance with auto-discovery of public methods
  registerService(serviceName: string, serviceInstance: unknown) {
    this.services.set(serviceName, serviceInstance);
    this.logger.info(`Registered service: ${serviceName}`);

    // Auto-discover public methods from the service instance
    this.discoverServiceMethods(serviceName, serviceInstance);
  }

  // Auto-discover and register all public methods from a service
  private discoverServiceMethods(
    serviceName: string,
    serviceInstance: unknown
  ) {
    const methods = this.getPublicMethods(serviceInstance);

    methods.forEach((methodDef) => {
      const eventName = `${serviceName}:${methodDef.name}`;
      this.logger.info(`Registering socket event: ${eventName}`);

      // Register the method as a socket event listener
      this.io.on("connection", (socket) => {
        this.registerMethodListener(
          socket as CustomSocket,
          eventName,
          methodDef
        );
      });
    });

    // Also register subscription methods
    const subscribeEventName = `${serviceName}:subscribe`;
    this.io.on("connection", (socket) => {
      this.registerSubscriptionListener(
        socket as CustomSocket,
        subscribeEventName,
        serviceInstance as {
          subscribe: (
            entryId: string,
            socket: CustomSocket,
            requiredLevel?: string
          ) => Promise<unknown>;
        }
      );
    });

    const unsubscribeEventName = `${serviceName}:unsubscribe`;
    this.io.on("connection", (socket) => {
      this.registerUnsubscriptionListener(
        socket as CustomSocket,
        unsubscribeEventName,
        serviceInstance as {
          unsubscribe: (entryId: string, socket: CustomSocket) => void;
        }
      );
    });
  }

  // Extract public methods from service instance
  private getPublicMethods(
    serviceInstance: unknown
  ): ServiceMethodDefinition[] {
    const methods: ServiceMethodDefinition[] = [];

    // Look for methods that match our definePublicMethod pattern
    // Check both instance properties and prototype properties
    const instancePropertyNames = Object.getOwnPropertyNames(
      serviceInstance as Record<string, unknown>
    );
    const proto = Object.getPrototypeOf(
      serviceInstance as Record<string, unknown>
    ) as object;
    const prototypePropertyNames = Object.getOwnPropertyNames(proto);
    const allPropertyNames = [
      ...new Set([...instancePropertyNames, ...prototypePropertyNames]),
    ];

    allPropertyNames.forEach((propertyName) => {
      const property = (serviceInstance as Record<string, unknown>)[
        propertyName
      ];

      // Check if it's a method definition from definePublicMethod
      if (
        property &&
        typeof property === "object" &&
        (property as { name?: unknown }).name &&
        (property as { handler?: unknown }).handler
      ) {
        const def = property as ServiceMethodDefinition;
        this.logger.debug(`Found public method: ${def.name}`);
        methods.push(def);
      }
    });

    this.logger.info(`Discovered ${methods.length} public methods for service`);
    return methods;
  }

  // Register a method as a socket event listener with error handling
  private registerMethodListener(
    socket: CustomSocket,
    eventName: string,
    methodDef: ServiceMethodDefinition
  ) {
    socket.on(
      eventName,
      async (
        payload: unknown,
        callback?: (response: ServiceResponse<unknown>) => void
      ) => {
        const startedAt = Date.now();
        const [serviceName, methodName] = eventName.split(":");
        const userIdShort = socket.userId
          ? String(socket.userId).slice(0, 8)
          : "anonymous";
        try {
          this.logger.debug(`Handling ${eventName}`, {
            userId: socket.userId,
            payload,
          });

          // Ensure socket has userId (authentication check)
          if (!socket.userId) {
            const errorResponse: ServiceResponse<unknown> = {
              success: false,
              error: "Authentication required",
              code: 401,
            };

            if (callback) callback(errorResponse);
            return;
          }

          // Ensure user has default service access permissions
          await this.ensureDefaultServiceAccess(socket);

          // Enforce access defined by the method, including optional entry-level ACLs
          const serviceName = eventName.split(":")[0];
          const serviceInstance = (this.services.get(serviceName) || {}) as {
            ensureAccessForMethod?: (
              requiredLevel: string,
              socket: CustomSocket,
              entryId?: string
            ) => Promise<void>;
          };
          const resolveEntryId = (
            methodDef as unknown as {
              resolveEntryId?: (payload: unknown) => string | null;
            }
          ).resolveEntryId;
          if (serviceInstance.ensureAccessForMethod) {
            let entryId = resolveEntryId
              ? resolveEntryId(payload) || undefined
              : undefined;
            if (
              !entryId &&
              payload &&
              typeof payload === "object" &&
              "id" in (payload as Record<string, unknown>)
            ) {
              const v = (payload as Record<string, unknown>)["id"];
              if (typeof v === "string") entryId = v;
            }
            await serviceInstance.ensureAccessForMethod(
              methodDef.access,
              socket,
              entryId
            );
          }

          // Log start (human + JSON)
          this.logger.info(
            `User ${userIdShort} ${serviceName}.${methodName} -> start`,
            {
              category: "request_processing",
              serviceName,
              methodName,
              userId: socket.userId,
              socketId: socket.id,
              payload,
            }
          );

          const result = await methodDef.handler(payload, socket);

          const successResponse: ServiceResponse<unknown> = {
            success: true,
            data: result,
          };

          // Log success (human + JSON)
          const durationMs = Date.now() - startedAt;
          this.logger.info(
            `User ${userIdShort} ${serviceName}.${methodName} -> success`,
            {
              category: "request_processing",
              outcome: "success",
              durationMs,
              serviceName,
              methodName,
              userId: socket.userId,
              socketId: socket.id,
              payload,
              result,
            }
          );

          if (callback) callback(successResponse);
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          // Log failure (human + JSON)
          this.logger.info(
            `User ${userIdShort} ${serviceName}.${methodName} -> fail`,
            {
              category: "request_processing",
              outcome: "fail",
              durationMs,
              serviceName,
              methodName,
              userId: socket.userId,
              socketId: socket.id,
              payload,
            }
          );
          this.logger.error(`Error in ${eventName}:`, error as Error);

          const errorResponse: ServiceResponse<unknown> = {
            success: false,
            error:
              error instanceof Error ? error.message : "Internal server error",
            code: 500,
          };

          if (callback) callback(errorResponse);
        }
      }
    );
  }

  // Register subscription listener
  private registerSubscriptionListener(
    socket: CustomSocket,
    eventName: string,
    serviceInstance: {
      subscribe: (
        entryId: string,
        socket: CustomSocket,
        requiredLevel?: string
      ) => Promise<unknown>;
    }
  ) {
    socket.on(
      eventName,
      async (
        payload: { entryId: string; requiredLevel?: string },
        callback?: (response: ServiceResponse<unknown>) => void
      ) => {
        try {
          if (!socket.userId) {
            const errorResponse: ServiceResponse<unknown> = {
              success: false,
              error: "Authentication required",
              code: 401,
            };
            if (callback) callback(errorResponse);
            return;
          }

          // Call the service's subscribe method and get current data
          const currentData = await serviceInstance.subscribe(
            payload.entryId,
            socket,
            payload.requiredLevel || "Read"
          );

          if (currentData === null || typeof currentData === "undefined") {
            // If subscribing to self but no row exists yet, allow subscription with null data
            if (socket.userId && payload.entryId === socket.userId) {
              const successResponse: ServiceResponse<unknown> = {
                success: true,
                data: null,
              };
              if (callback) callback(successResponse);
              return;
            }

            const errorResponse: ServiceResponse<unknown> = {
              success: false,
              error: "Access denied or entry not found",
              code: 403,
            };
            if (callback) callback(errorResponse);
            return;
          }

          const successResponse: ServiceResponse<unknown> = {
            success: true,
            data: currentData,
          };

          if (callback) callback(successResponse);
        } catch (error) {
          this.logger.error(`Error in subscription ${eventName}:`, error);

          const errorResponse: ServiceResponse<unknown> = {
            success: false,
            error:
              error instanceof Error ? error.message : "Subscription failed",
          };

          if (callback) callback(errorResponse);
        }
      }
    );
  }

  // Register unsubscription listener
  private registerUnsubscriptionListener(
    socket: CustomSocket,
    eventName: string,
    serviceInstance: {
      unsubscribe: (entryId: string, socket: CustomSocket) => void;
    }
  ) {
    socket.on(
      eventName,
      (
        payload: { entryId: string },
        callback?: (
          response: ServiceResponse<{ unsubscribed: true; entryId: string }>
        ) => void
      ) => {
        try {
          serviceInstance.unsubscribe(payload.entryId, socket);

          const successResponse: ServiceResponse<{
            unsubscribed: true;
            entryId: string;
          }> = {
            success: true,
            data: { unsubscribed: true, entryId: payload.entryId },
          };

          if (callback) callback(successResponse);
        } catch (error) {
          this.logger.error(`Error in unsubscription ${eventName}:`, error);

          const errorResponse: ServiceResponse<unknown> = {
            success: false,
            error:
              error instanceof Error ? error.message : "Unsubscription failed",
          };

          if (callback) callback(errorResponse);
        }
      }
    );
  }

  // Get all registered services
  getServices(): string[] {
    return Array.from(this.services.keys());
  }

  // Expose service instances for connection lifecycle management
  getServiceInstances(): Array<{
    unsubscribeSocket?: (socket: CustomSocket) => void;
  }> {
    return Array.from(this.services.values()) as Array<{
      unsubscribeSocket?: (socket: CustomSocket) => void;
    }>;
  }
}

export default ServiceRegistry;

// Evergreen comment: Central registry for auto-discovering and registering service methods as Socket.io events.
