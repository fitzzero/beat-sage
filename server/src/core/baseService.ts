import { prisma } from "../db";
import { testPrisma } from "../db/testDb";
import { Logger } from "winston";
import { Socket } from "socket.io";
import logger from "../utils/logger"; // Assume logger util is created separately
import type { PrismaClient } from "@prisma/client";
import type { ServiceMethodDefinition } from "../types/socket";
// Prisma replaces Drizzle; generic helpers below become shaped around model names and field names

type AccessLevel = "Public" | "Read" | "Moderate" | "Admin";

type ACE = {
  userId: string;
  level: AccessLevel;
};

type ACL = ACE[];

type AclRow = {
  acl: Array<{ userId: string; level: AccessLevel }> | null;
};

export type CustomSocket = Socket & {
  userId?: string;
  serviceAccess?: Record<string, "Read" | "Moderate" | "Admin">;
};

type BaseServiceOptions<
  TModelName extends keyof import("@prisma/client").PrismaClient
> = {
  model: TModelName;
  hasEntryACL: boolean;
  defaultACL?: ACL;
  serviceName: string;
};

type InstallAdminMethodsOptions = {
  expose: {
    list?: boolean;
    get?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
    setEntryACL?: boolean;
    getSubscribers?: boolean;
    reemit?: boolean;
    unsubscribeAll?: boolean;
  };
  access: {
    list: AccessLevel;
    get: AccessLevel;
    create: AccessLevel;
    update: AccessLevel;
    delete: AccessLevel;
    setEntryACL: AccessLevel;
    getSubscribers: AccessLevel;
    reemit: AccessLevel;
    unsubscribeAll: AccessLevel;
  };
};

class BaseService<
  TModelName extends keyof import("@prisma/client").PrismaClient,
  TEntity extends Record<string, unknown> = Record<string, unknown>,
  TCreateInput extends Record<string, unknown> = Record<string, unknown>,
  TUpdateInput extends Record<string, unknown> = Record<string, unknown>,
  TServiceMethods = unknown
> {
  protected model: TModelName;
  protected hasEntryACL: boolean;
  protected defaultACL: ACL;
  protected subscribers: Map<string, Set<CustomSocket>> = new Map(); // entryId -> Set of sockets
  protected logger: Logger;
  protected db: import("@prisma/client").PrismaClient;
  protected serviceName: string;

  constructor(options: BaseServiceOptions<TModelName>) {
    this.model = options.model;
    this.hasEntryACL = options.hasEntryACL;
    this.defaultACL = options.defaultACL || [];
    this.serviceName = options.serviceName;
    this.logger = logger.child({ service: this.constructor.name });
    // Use test database in test environment, regular db otherwise
    this.db = process.env.NODE_ENV === "test" ? testPrisma : prisma;
  }

  // Strongly-typed Prisma delegate for the configured model
  protected get delegate(): PrismaClient[TModelName] {
    return this.db[this.model] as unknown as PrismaClient[TModelName];
  }

  // Subscription method
  public async subscribe(
    entryId: string,
    socket: CustomSocket,
    requiredLevel: AccessLevel = "Read"
  ): Promise<Record<string, unknown> | null> {
    if (!socket.userId) {
      return null;
    }

    // First, service-level access check (or self, via service override)
    let allowed = this.checkAccess(
      socket.userId,
      entryId,
      requiredLevel,
      socket
    );

    // If not allowed and entries have ACLs, check entry-level ACL on the row
    if (!allowed && this.hasEntryACL) {
      try {
        const row = await (
          this.db[this.model] as unknown as {
            findUnique: (args: {
              where: { id: string };
              select: { acl: true };
            }) => Promise<AclRow | null>;
          }
        ).findUnique({ where: { id: entryId }, select: { acl: true } });
        const aclList =
          (row?.acl as Array<{ userId: string; level: AccessLevel }>) || [];
        const ace = aclList.find((a) => a.userId === socket.userId);
        if (ace) {
          const levelOrder: Record<AccessLevel, number> = {
            Public: 0,
            Read: 1,
            Moderate: 2,
            Admin: 3,
          };
          allowed =
            (levelOrder[ace.level] || 0) >= (levelOrder[requiredLevel] || 0);
        }
      } catch {
        allowed = false;
      }
    }

    if (!allowed) {
      return null;
    }

    if (!this.subscribers.has(entryId)) {
      this.subscribers.set(entryId, new Set());
    }
    this.subscribers.get(entryId)!.add(socket);
    this.logger.info(`User ${socket.userId} subscribed to ${entryId}`);

    // Fetch and return the current entry data
    const row = await (
      this.db[this.model] as unknown as {
        findUnique: (args: {
          where: { id: string };
        }) => Promise<Record<string, unknown> | null>;
      }
    ).findUnique({ where: { id: entryId } });
    return row ?? null;
  }

  // Unsubscribe
  public unsubscribe(entryId: string, socket: CustomSocket) {
    this.subscribers.get(entryId)?.delete(socket);
    if (this.subscribers.get(entryId)?.size === 0) {
      this.subscribers.delete(entryId);
    }
  }

  // Emit update to subscribers
  protected emitUpdate(entryId: string, data: Record<string, unknown>) {
    // Partial for updates/deletes
    this.subscribers.get(entryId)?.forEach((socket) => {
      socket.emit(`${this.serviceName}:update:${entryId}`, data);
    });
  }

  // ACL check (simplified; implement based on actual logic)
  protected checkAccess(
    userId: string | undefined,
    entryId: string,
    requiredLevel: AccessLevel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    socket?: CustomSocket
  ): boolean {
    if (!userId) return false;
    this.logger.debug(
      `Checking access for user ${userId} on ${entryId} at level ${requiredLevel}`
    );
    // Default deny unless overridden by service
    return false;
  }

  // ----- Admin helpers & hooks -----

  protected isAccessLevelSufficient(
    userLevel: AccessLevel,
    requiredLevel: AccessLevel
  ): boolean {
    const levels: Record<AccessLevel, number> = {
      Public: 0,
      Read: 1,
      Moderate: 2,
      Admin: 3,
    };
    return (levels[userLevel] || 0) >= (levels[requiredLevel] || 0);
  }

  protected hasServiceAccess(
    socket: CustomSocket,
    requiredLevel: AccessLevel
  ): boolean {
    const userLevel = socket?.serviceAccess?.[this.serviceName] as
      | AccessLevel
      | undefined;
    return (
      !!userLevel && this.isAccessLevelSufficient(userLevel, requiredLevel)
    );
  }

  protected getDefaultDeniedFields(): string[] {
    return [
      "id",
      "createdAt",
      "updatedAt",
      "serviceAccess",
      "service_access",
      "acl",
    ];
  }

  // Public wrapper to enforce access for public methods
  public async ensureAccessForMethod(
    requiredLevel: AccessLevel,
    socket: CustomSocket,
    entryId?: string
  ): Promise<void> {
    if (requiredLevel === "Public") {
      return;
    }
    if (!socket.userId) {
      throw new Error("Authentication required");
    }

    // If method is entry-scoped
    if (entryId) {
      // Service-level access suffices
      if (this.hasServiceAccess(socket, requiredLevel)) {
        return;
      }
      // Allow services to implement self or custom logic via checkAccess
      let allowed = this.checkAccess(
        socket.userId,
        entryId,
        requiredLevel,
        socket
      );
      if (!allowed) {
        allowed = await this.evaluateEntryAccess(
          socket.userId,
          entryId,
          requiredLevel,
          socket
        );
      }
      if (!allowed) throw new Error("Insufficient permissions");
      return;
    }

    // Non-entry scoped methods
    if (requiredLevel === "Read") {
      // Authenticated users may invoke Read-level non-entry methods
      return;
    }
    if (!this.hasServiceAccess(socket, requiredLevel)) {
      throw new Error("Insufficient permissions");
    }
  }

  // Default entry-level access evaluator: consults entry ACL if present
  // Services can override to implement custom per-entry logic (e.g., messages referencing chat ACLs)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async evaluateEntryAccess(
    userId: string,
    entryId: string,
    requiredLevel: AccessLevel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    socket: CustomSocket
  ): Promise<boolean> {
    if (!this.hasEntryACL) {
      return false;
    }
    try {
      const row = await (
        this.db[this.model] as unknown as {
          findUnique: (args: {
            where: { id: string };
            select: { acl: true };
          }) => Promise<AclRow | null>;
        }
      ).findUnique({ where: { id: entryId }, select: { acl: true } });
      const aclList =
        (row?.acl as Array<{ userId: string; level: AccessLevel }>) || [];
      const ace = aclList.find((a) => a.userId === userId);
      if (!ace) return false;
      const levelOrder: Record<AccessLevel, number> = {
        Public: 0,
        Read: 1,
        Moderate: 2,
        Admin: 3,
      };
      return (levelOrder[ace.level] || 0) >= (levelOrder[requiredLevel] || 0);
    } catch {
      return false;
    }
  }

  protected getAdminEditableFields(): string[] {
    // Default: allow all except deny-listed fields (services can override)
    return [];
  }

  protected sanitizeAdminCreateData(
    raw: Record<string, unknown>,
    _socket: CustomSocket
  ): Partial<TCreateInput> {
    const denied = new Set(this.getDefaultDeniedFields());
    const editable = this.getAdminEditableFields();
    const allowAllExceptDenied = editable.length === 0;
    const result: Record<string, unknown> = {};
    Object.entries(raw || {}).forEach(([key, value]) => {
      if (denied.has(key)) return;
      if (allowAllExceptDenied || editable.includes(key)) {
        result[key] = value;
      }
    });
    return result as Partial<TCreateInput>;
  }

  protected sanitizeAdminUpdateData(
    raw: Record<string, unknown>,
    _socket: CustomSocket
  ): Partial<TUpdateInput> {
    const denied = new Set(this.getDefaultDeniedFields());
    const editable = this.getAdminEditableFields();
    const allowAllExceptDenied = editable.length === 0;
    const result: Record<string, unknown> = {};
    Object.entries(raw || {}).forEach(([key, value]) => {
      if (denied.has(key)) return;
      if (allowAllExceptDenied || editable.includes(key)) {
        result[key] = value;
      }
    });
    return result as Partial<TUpdateInput>;
  }

  protected allowedAdminSortFields(): string[] {
    return ["id", "createdAt", "updatedAt"];
  }

  // Allow services to extend filters with additional where clauses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected extendAdminListFilter(
    _filter: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    return undefined;
  }

  // Attach admin methods to the instance for ServiceRegistry discovery
  protected installAdminMethods(options: InstallAdminMethodsOptions) {
    const self = this as unknown as Record<string, unknown>;

    type Row = TEntity;
    type Insert = TCreateInput;

    const subscribeMap = this.subscribers;

    // adminList
    if (options.expose.list) {
      self["adminList"] = this.definePublicMethod<
        {
          page?: number;
          pageSize?: number;
          sort?: { field?: string; direction?: "asc" | "desc" };
          filter?: {
            id?: string;
            ids?: string[];
            createdAfter?: string;
            createdBefore?: string;
            updatedAfter?: string;
            updatedBefore?: string;
          };
        },
        { rows: Row[]; page: number; pageSize: number; total: number }
      >("adminList", options.access.list, async (payload, socket) => {
        if (!this.hasServiceAccess(socket, options.access.list)) {
          throw new Error("Insufficient permissions");
        }

        const page = Math.max(1, Math.floor(payload.page ?? 1));
        const pageSizeRaw = Math.floor(payload.pageSize ?? 25);
        const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
        const offset = (page - 1) * pageSize;

        const sortField = payload.sort?.field || "updatedAt";
        const sortDir = payload.sort?.direction === "asc" ? "asc" : "desc";

        const f = payload.filter || {};
        const createdAfter = f.createdAfter
          ? new Date(f.createdAfter)
          : undefined;
        const createdBefore = f.createdBefore
          ? new Date(f.createdBefore)
          : undefined;
        const updatedAfter = f.updatedAfter
          ? new Date(f.updatedAfter)
          : undefined;
        const updatedBefore = f.updatedBefore
          ? new Date(f.updatedBefore)
          : undefined;

        const where: Record<string, unknown> = {};
        if (f.id) where["id"] = f.id;
        if (Array.isArray(f.ids) && f.ids.length > 0)
          where["id"] = { in: f.ids };
        if (createdAfter || createdBefore)
          where["createdAt"] = { gte: createdAfter, lte: createdBefore };
        if (updatedAfter || updatedBefore)
          where["updatedAt"] = { gte: updatedAfter, lte: updatedBefore };
        const extended = this.extendAdminListFilter(f);
        Object.assign(where, extended || {});

        const rows = await (
          this.delegate as unknown as {
            findMany: (args: {
              where?: Record<string, unknown>;
              orderBy?: Record<string, "asc" | "desc">;
              skip?: number;
              take?: number;
            }) => Promise<Row[]>;
          }
        ).findMany({
          where,
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        });
        const total = rows.length;
        this.logger.debug("adminList", {
          page,
          pageSize,
          total,
          sortField,
          sortDir,
        });
        return { rows, page, pageSize, total };
      });
    }

    // adminGet
    if (options.expose.get) {
      self["adminGet"] = this.definePublicMethod<
        { id: string },
        Row | undefined
      >("adminGet", options.access.get, async (payload, socket) => {
        if (!this.hasServiceAccess(socket, options.access.get)) {
          throw new Error("Insufficient permissions");
        }
        const result = await (
          this.delegate as unknown as {
            findUnique: (args: {
              where: { id: string };
            }) => Promise<Row | null>;
          }
        ).findUnique({ where: { id: payload.id } });
        return result ?? undefined;
      });
    }

    // adminCreate
    if (options.expose.create) {
      self["adminCreate"] = this.definePublicMethod<
        { data: Partial<Insert> },
        Row
      >("adminCreate", options.access.create, async (payload, socket) => {
        if (!this.hasServiceAccess(socket, options.access.create)) {
          throw new Error("Insufficient permissions");
        }
        const data = this.sanitizeAdminCreateData(
          payload.data as Record<string, unknown>,
          socket
        );
        const created: Row = await this.create(data as unknown as Insert);
        this.logger.info(`Admin created entry`, {
          service: this.serviceName,
        });
        return created;
      });
    }

    // adminUpdate
    if (options.expose.update) {
      self["adminUpdate"] = this.definePublicMethod<
        { id: string; data: Partial<Insert> },
        Row | undefined
      >("adminUpdate", options.access.update, async (payload, socket) => {
        // Prefer service-level access; allow service overrides via checkAccess for self/entry ACL
        const can =
          this.hasServiceAccess(socket, options.access.update) ||
          this.checkAccess(
            socket.userId,
            payload.id,
            options.access.update,
            socket
          );
        if (!can) {
          throw new Error("Insufficient permissions");
        }

        const data = this.sanitizeAdminUpdateData(
          payload.data as Record<string, unknown>,
          socket
        );
        const updated: Row | undefined = await this.update(
          payload.id,
          data as unknown as TUpdateInput
        );
        if (updated) {
          this.logger.info(`Admin updated entry ${payload.id}`);
        }
        return updated;
      });
    }

    // adminDelete
    if (options.expose.delete) {
      self["adminDelete"] = this.definePublicMethod<
        { id: string },
        { id: string; deleted: true }
      >("adminDelete", options.access.delete, async (payload, socket) => {
        // Prefer service-level access; allow entry-level override via evaluateEntryAccess (e.g., ACL Admin on the entry)
        let can = this.hasServiceAccess(socket, options.access.delete);
        if (!can && socket.userId) {
          can = await this.evaluateEntryAccess(
            socket.userId,
            payload.id,
            options.access.delete,
            socket
          );
        }
        if (!can) {
          throw new Error("Insufficient permissions");
        }
        await this.delete(payload.id);
        return { id: payload.id, deleted: true } as const;
      });
    }

    // adminSetEntryACL (only if hasEntryACL)
    if (options.expose.setEntryACL && this.hasEntryACL) {
      self["adminSetEntryACL"] = this.definePublicMethod<
        { id: string; acl: Array<{ userId: string; level: AccessLevel }> },
        Row | undefined
      >(
        "adminSetEntryACL",
        options.access.setEntryACL,
        async (payload, socket) => {
          if (!this.hasServiceAccess(socket, options.access.setEntryACL)) {
            throw new Error("Insufficient permissions");
          }
          if (!Array.isArray(payload.acl)) {
            throw new Error("Invalid ACL payload");
          }
          const patch = {
            acl: payload.acl,
          } as unknown as TUpdateInput;
          const updated: Row | undefined = await this.update(payload.id, patch);
          if (updated)
            this.logger.info(`Admin set ACL for entry ${payload.id}`);
          return updated;
        }
      );
    }

    // adminGetSubscribers
    if (options.expose.getSubscribers) {
      self["adminGetSubscribers"] = this.definePublicMethod<
        { id: string },
        {
          id: string;
          subscribers: Array<{ socketId: string; userId?: string }>;
        }
      >(
        "adminGetSubscribers",
        options.access.getSubscribers,
        // eslint-disable-next-line @typescript-eslint/require-await
        async (payload, socket) => {
          if (!this.hasServiceAccess(socket, options.access.getSubscribers)) {
            throw new Error("Insufficient permissions");
          }
          const subs = Array.from(
            subscribeMap.get(payload.id) || new Set()
          ).map((s) => ({
            socketId: (s as CustomSocket).id,
            userId: (s as CustomSocket).userId,
          }));
          return { id: payload.id, subscribers: subs };
        }
      );
    }

    // adminReemit
    if (options.expose.reemit) {
      self["adminReemit"] = this.definePublicMethod<
        { id: string },
        { emitted: boolean }
      >(
        "adminReemit",
        options.access.reemit,
        // eslint-disable-next-line @typescript-eslint/require-await
        async (payload, socket) => {
          if (!this.hasServiceAccess(socket, options.access.reemit)) {
            throw new Error("Insufficient permissions");
          }
          const result = await (
            this.db[this.model] as unknown as {
              findUnique: (args: {
                where: { id: string };
              }) => Promise<Record<string, unknown> | null>;
            }
          ).findUnique({ where: { id: payload.id } });
          if (!result) return { emitted: false } as const;
          this.emitUpdate(
            payload.id,
            result as unknown as Record<string, unknown>
          );
          return { emitted: true } as const;
        }
      );
    }

    // adminUnsubscribeAll
    if (options.expose.unsubscribeAll) {
      self["adminUnsubscribeAll"] = this.definePublicMethod<
        { id: string },
        { id: string; unsubscribed: number }
      >(
        "adminUnsubscribeAll",
        options.access.unsubscribeAll,
        // eslint-disable-next-line @typescript-eslint/require-await
        async (payload, socket) => {
          if (!this.hasServiceAccess(socket, options.access.unsubscribeAll)) {
            throw new Error("Insufficient permissions");
          }
          const set = this.subscribers.get(payload.id);
          const count = set ? set.size : 0;
          if (set) {
            set.clear();
            this.subscribers.delete(payload.id);
          }
          return { id: payload.id, unsubscribed: count } as const;
        }
      );
    }
  }

  // CRUD methods (private, with auto emit)
  protected async create(data: TCreateInput): Promise<TEntity> {
    const entry = await (
      this.delegate as unknown as {
        create: (args: { data: TCreateInput }) => Promise<TEntity>;
      }
    ).create({ data });
    const entryId = (entry as unknown as { id: string }).id;
    this.emitUpdate(entryId, entry as unknown as Record<string, unknown>);
    this.logger.info(`Created entry ${entryId}`);
    return entry;
  }

  protected async update(
    id: string,
    data: TUpdateInput
  ): Promise<TEntity | undefined> {
    try {
      const entry = await (
        this.delegate as unknown as {
          update: (args: {
            where: { id: string };
            data: TUpdateInput;
          }) => Promise<TEntity>;
        }
      ).update({ where: { id }, data });
      this.emitUpdate(id, entry as unknown as Record<string, unknown>);
      this.logger.info(`Updated entry ${id}`);
      return entry;
    } catch {
      return undefined;
    }
  }

  protected async delete(id: string): Promise<void> {
    await (
      this.delegate as unknown as {
        delete: (args: { where: { id: string } }) => Promise<unknown>;
      }
    ).delete({ where: { id } });
    this.emitUpdate(id, { id, deleted: true });
    this.logger.info(`Deleted entry ${id}`);
  }

  // Simple typed helper for common reads by id
  protected async findUnique(where: { id: string }): Promise<TEntity | null> {
    const row = await (
      this.delegate as unknown as {
        findUnique: (args: {
          where: { id: string };
        }) => Promise<TEntity | null>;
      }
    ).findUnique({ where });
    return row ?? null;
  }

  // Pattern for defining public methods
  protected definePublicMethod<P, R>(
    name: string,
    access: AccessLevel,
    handler: (payload: P, socket: CustomSocket) => Promise<R>,
    options?: { resolveEntryId?: (payload: P) => string | null }
  ): ServiceMethodDefinition<P, R> {
    // Auto glue to Socket.io would be set up in a central place, e.g., index.ts
    // This is just the definition; actual binding happens elsewhere
    return { name, access, handler, resolveEntryId: options?.resolveEntryId };
  }

  // Convenience: define method using the service's shared method map
  protected defineMethod<
    K extends keyof TServiceMethods & string,
    P = K extends keyof TServiceMethods
      ? TServiceMethods[K] extends { payload: infer PP }
        ? PP
        : never
      : never,
    R = K extends keyof TServiceMethods
      ? TServiceMethods[K] extends { response: infer RR }
        ? RR
        : never
      : never
  >(
    name: K,
    access: AccessLevel,
    handler: (payload: P, socket: CustomSocket) => Promise<R>,
    options?: { resolveEntryId?: (payload: P) => string | null }
  ): ServiceMethodDefinition<P, R> {
    return this.definePublicMethod<P, R>(
      String(name),
      access,
      handler,
      options
    );
  }

  // Enforce exact response shapes for methods defined via defineMethod
  protected exactResponse<K extends keyof TServiceMethods & string>(
    _name: K,
    value: TServiceMethods[K] extends { response: infer R } ? R : never
  ): TServiceMethods[K] extends { response: infer R } ? R : never {
    return value as TServiceMethods[K] extends { response: infer R }
      ? R
      : never;
  }

  // Remove a socket from all subscriptions to prevent leaks on disconnect
  public unsubscribeSocket(socket: CustomSocket) {
    for (const [entryId, socketSet] of this.subscribers.entries()) {
      if (socketSet.has(socket)) {
        socketSet.delete(socket);
        if (socketSet.size === 0) {
          this.subscribers.delete(entryId);
        }
      }
    }
  }
}

export default BaseService;

// Evergreen comment: BaseService provides consistency across services; extend for specific services with schema and custom methods.
// Potential adjustment: Enhance ACL logic with DB integration and caching for performance.
