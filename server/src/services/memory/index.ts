import BaseService from "../../core/baseService";
import type { Memory as PrismaMemory, Prisma } from "@prisma/client";
import { memoryConfig } from "../../config/memory";
import { layeredSearch } from "./middleware/search";
import { normalizeContentAndSuggestTags } from "./middleware/llm";
import { createMemoryHandler } from "./methods/createMemory";
import type { MemoryServiceMethods } from "@shared/types";

type MemoryPatch = Partial<{
  title: string;
  content: string;
  type: string;
  tags: string[];
  associatedIds: string[];
  pinned: boolean;
  importance: number;
  acl: Array<{ userId: string; level: "Read" | "Moderate" | "Admin" }>;
}>;

class MemoryService extends BaseService<
  "memory",
  PrismaMemory,
  Prisma.MemoryUncheckedCreateInput,
  Prisma.MemoryUncheckedUpdateInput,
  MemoryServiceMethods
> {
  constructor() {
    super({
      model: "memory",
      hasEntryACL: true,
      serviceName: "memoryService",
    });

    this.installAdminMethods({
      expose: {
        list: true,
        get: true,
        create: false,
        update: true,
        delete: true,
        setEntryACL: this.hasEntryACL,
        getSubscribers: true,
        reemit: true,
        unsubscribeAll: true,
      },
      access: {
        list: "Moderate",
        get: "Moderate",
        create: "Admin",
        update: "Moderate",
        delete: "Admin",
        setEntryACL: "Admin",
        getSubscribers: "Admin",
        reemit: "Admin",
        unsubscribeAll: "Admin",
      },
    });
  }

  // Public API placeholders; implement in ./methods/*.ts
  public createMemory = this.defineMethod(
    "createMemory",
    "Read",
    (payload, socket) => createMemoryHandler(this, payload, socket)
  );

  public findMemories = this.defineMethod(
    "findMemories",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const rows = await layeredSearch(
        {
          query: payload.query,
          filters: payload.filters,
          limit: payload.limit,
          offset: (payload as { offset?: number }).offset,
          includeAssociationsDepth: payload.includeAssociationsDepth,
        },
        (
          this["db"][this["model"]] as unknown as {
            findMany: (args: {
              where?: Record<string, unknown>;
              take?: number;
              orderBy?: Record<string, "asc" | "desc">;
            }) => Promise<Record<string, unknown>[]>;
          }
        ).findMany
      );

      // Filter by ACL for caller
      const filtered = await this.filterByReadAccess(rows, socket);

      // Association expansion (depth-limited)
      const depth = Math.min(
        Math.max(
          0,
          Math.floor(
            payload.includeAssociationsDepth ??
              memoryConfig.search.includeAssociationsDepth
          )
        ),
        3
      );
      const expanded = await this.expandAssociations(filtered, depth, socket);

      // Update usage metadata
      const ids = filtered.map((r) => (r as { id: string }).id);
      if (ids.length > 0) {
        await (
          this["db"][this["model"]] as unknown as {
            updateMany: (args: {
              where: { id: { in: string[] } };
              data: { lastAccessedAt: Date; usageCount: { increment: number } };
            }) => Promise<unknown>;
          }
        ).updateMany({
          where: { id: { in: ids } },
          data: { lastAccessedAt: new Date(), usageCount: { increment: 1 } },
        });
      }

      // Attach nested related trees per result
      const withTrees: Array<Record<string, unknown>> = [];
      for (const row of expanded) {
        const tree = await this.buildRelatedTree(
          row,
          depth,
          socket,
          new Set([(row as { id: string }).id])
        );
        withTrees.push(this.toDTO(tree, socket));
      }
      return this.exactResponse("findMemories", {
        results: withTrees as never,
      });
    }
  );

  public getMemory = this.defineMethod(
    "getMemory",
    "Read",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const row = await (
        this["db"][this["model"]] as unknown as {
          findUnique: (args: {
            where: { id: string };
          }) => Promise<Record<string, unknown> | null>;
        }
      ).findUnique({ where: { id: payload.id } });
      if (!row) return { memory: undefined };
      // Allow service-level Read or above; otherwise fall back to entry-level ACL
      let canRead = this["hasServiceAccess"](socket, "Read");
      if (!canRead) {
        canRead = await this["evaluateEntryAccess"](
          socket.userId,
          (row as { id: string }).id,
          "Read",
          socket
        );
      }
      if (!canRead) return { memory: undefined };
      const depth = Math.min(
        Math.max(0, Math.floor(payload.includeAssociationsDepth ?? 0)),
        3
      );
      const tree = await this.buildRelatedTree(
        row,
        depth,
        socket,
        new Set([(row as { id: string }).id])
      );
      return this.exactResponse("getMemory", {
        memory: this.toDTO(tree, socket) as never,
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  public updateMemory = this.defineMethod(
    "updateMemory",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const allowedFields = new Set([
        "title",
        "content",
        "type",
        "tags",
        "associatedIds",
        "pinned",
        "importance",
        "acl",
      ]);
      const patch: MemoryPatch = {};
      Object.entries(payload.patch || {}).forEach(([k, v]) => {
        if (allowedFields.has(k)) (patch as Record<string, unknown>)[k] = v;
      });
      // If content changes, attempt normalization
      if (
        typeof patch.content === "string" &&
        patch.content.trim().length > 0
      ) {
        try {
          const norm = await normalizeContentAndSuggestTags(patch.content);
          patch.content = norm.content;
          if (Array.isArray(patch.tags)) {
            const currentTags = patch.tags;
            patch.tags = Array.from(new Set([...currentTags, ...norm.tags]));
          } else {
            patch.tags = norm.tags;
          }
        } catch {
          // ignore
        }
      }
      const updated = await this["update"](
        payload.id,
        patch as Prisma.MemoryUncheckedUpdateInput
      );
      return this.exactResponse("updateMemory", {
        memory: updated ? (this.toDTO(updated, socket) as never) : undefined,
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  public linkMemories = this.defineMethod(
    "linkMemories",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const db = this["db"][this["model"]] as unknown as {
        findUnique: (args: {
          where: { id: string };
        }) => Promise<Record<string, unknown> | null>;
        update: (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => Promise<Record<string, unknown>>;
      };
      // Validate targets exist
      const current = (await db.findUnique({ where: { id: payload.id } })) as
        | (Record<string, unknown> & { associatedIds?: string[] })
        | null;
      if (!current) throw new Error("Entry not found");
      const existing = current.associatedIds ?? [];
      const targets = payload.associate;
      const validTargets: string[] = [];
      for (const tId of targets) {
        const t = await db.findUnique({ where: { id: tId } });
        if (t) validTargets.push(tId);
      }
      // "Transactional" best-effort: sequential updates; in real DB, wrap in transaction
      const merged = Array.from(
        new Set([...existing, ...validTargets].filter((x) => x !== payload.id))
      );
      const updated = await this["update"](payload.id, {
        associatedIds: merged,
      });
      if (payload.bidirectional) {
        for (const targetId of validTargets) {
          const t = (await db.findUnique({ where: { id: targetId } })) as
            | (Record<string, unknown> & { associatedIds?: string[] })
            | null;
          const tExisting = t?.associatedIds ?? [];
          const tMerged = Array.from(new Set([...tExisting, payload.id]));
          await this["update"](targetId, { associatedIds: tMerged });
        }
      }
      return this.exactResponse("linkMemories", {
        id: payload.id,
        associatedIds: (updated as { associatedIds: string[] }).associatedIds,
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  public unlinkMemories = this.defineMethod(
    "unlinkMemories",
    "Moderate",
    async (payload, socket) => {
      if (!socket.userId) throw new Error("Authentication required");
      const db = this["db"][this["model"]] as unknown as {
        findUnique: (args: {
          where: { id: string };
        }) => Promise<Record<string, unknown> | null>;
      };
      const current = (await db.findUnique({ where: { id: payload.id } })) as
        | (Record<string, unknown> & { associatedIds?: string[] })
        | null;
      if (!current) throw new Error("Entry not found");
      const existing = current.associatedIds ?? [];
      const toRemove = new Set(payload.remove);
      const filtered = existing.filter((id) => !toRemove.has(id));
      const updated = await this["update"](payload.id, {
        associatedIds: filtered,
      });
      if (payload.bidirectional) {
        for (const targetId of payload.remove) {
          const t = (await db.findUnique({ where: { id: targetId } })) as
            | (Record<string, unknown> & { associatedIds?: string[] })
            | null;
          const tExisting = t?.associatedIds ?? [];
          const tFiltered = tExisting.filter((v) => v !== payload.id);
          await this["update"](targetId, { associatedIds: tFiltered });
        }
      }
      return this.exactResponse("unlinkMemories", {
        id: payload.id,
        associatedIds: (updated as { associatedIds: string[] }).associatedIds,
      });
    },
    { resolveEntryId: (p) => (p as { id: string }).id }
  );

  // Placeholder for summarization; to be wired with orchestrator later
  public summarizeChatIfNeeded = this.defineMethod(
    "summarizeChatIfNeeded",
    "Moderate",
    // eslint-disable-next-line @typescript-eslint/require-await
    async (_payload, _socket) => {
      return this.exactResponse("summarizeChatIfNeeded", { created: false });
    }
  );

  // Access: owner Admin by default; service-level overrides via socket.serviceAccess
  protected checkAccess(
    userId: string | undefined,
    entryId: string,
    requiredLevel: "Public" | "Read" | "Moderate" | "Admin",
    socket?: Parameters<BaseService<never>["checkAccess"]>[3]
  ): boolean {
    if (!userId) return false;
    const level = socket?.serviceAccess?.["memoryService"];
    const hasServiceAccess = level
      ? this["isAccessLevelSufficient"](level, requiredLevel)
      : false;
    // Fallback to entry-level ACL via BaseService.evaluateEntryAccess when needed
    return hasServiceAccess;
  }

  private async filterByReadAccess(
    rows: Record<string, unknown>[],
    socket: Parameters<BaseService<never>["ensureAccessForMethod"]>[1]
  ) {
    // Service-level access bypasses per-entry ACL checks
    if (this["hasServiceAccess"](socket, "Read")) {
      return rows;
    }
    const result: Record<string, unknown>[] = [];
    for (const row of rows) {
      const id = (row as { id: string }).id;
      const canRead = await this["evaluateEntryAccess"](
        socket.userId!,
        id,
        "Read",
        socket
      );
      if (canRead) result.push(row);
    }
    return result;
  }

  private async expandAssociations(
    rows: Record<string, unknown>[],
    depth: number,
    socket: Parameters<BaseService<never>["ensureAccessForMethod"]>[1]
  ): Promise<Record<string, unknown>[]> {
    if (depth <= 0) return rows;
    const idSet = new Set<string>();
    rows.forEach((r) => {
      const assoc = (r as { associatedIds?: string[] }).associatedIds || [];
      assoc.forEach((id) => idSet.add(id));
    });
    if (idSet.size === 0) return rows;
    const related = await (
      this["db"][this["model"]] as unknown as {
        findMany: (args: {
          where: { id: { in: string[] } };
        }) => Promise<Record<string, unknown>[]>;
      }
    ).findMany({ where: { id: { in: Array.from(idSet) } } });
    const readable = await this.filterByReadAccess(related, socket);
    // Shallow attach related
    const byId = new Map(readable.map((r) => [(r as { id: string }).id, r]));
    const withRelated = rows.map((r) => {
      const assoc = (r as { associatedIds?: string[] }).associatedIds || [];
      const relatedObjs = assoc
        .map((id) => byId.get(id))
        .filter(Boolean) as Record<string, unknown>[];
      return { ...r, related: relatedObjs };
    });
    if (depth === 1) return withRelated;
    return this.expandAssociations(withRelated, depth - 1, socket);
  }

  private async buildRelatedTree(
    row: Record<string, unknown>,
    depth: number,
    socket: Parameters<BaseService<never>["ensureAccessForMethod"]>[1],
    visited: Set<string>
  ): Promise<Record<string, unknown>> {
    if (depth <= 0) return { ...row };
    const assoc = (row as { associatedIds?: string[] }).associatedIds || [];
    const nextIds = assoc.filter((id) => !visited.has(id));
    if (nextIds.length === 0) return { ...row };
    const related = await (
      this["db"][this["model"]] as unknown as {
        findMany: (args: {
          where: { id: { in: string[] } };
        }) => Promise<Record<string, unknown>[]>;
      }
    ).findMany({ where: { id: { in: nextIds } } });
    const readable = await this.filterByReadAccess(related, socket);
    const children: Array<Record<string, unknown>> = [];
    for (const child of readable) {
      const childId = (child as { id: string }).id;
      visited.add(childId);
      const childTree = await this.buildRelatedTree(
        child,
        depth - 1,
        socket,
        visited
      );
      children.push(this.toDTO(childTree, socket));
    }
    return { ...row, related: children };
  }

  private toDTO(
    row: Record<string, unknown>,
    socket: { serviceAccess?: Record<string, string> }
  ): Record<string, unknown> {
    // Strip ACL unless service-level Admin
    const isServiceAdmin = socket.serviceAccess?.["memoryService"] === "Admin";
    const { acl: _acl, ...rest } = row as Record<string, unknown> & {
      acl?: unknown;
    };
    const normalizeDates = (obj: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v instanceof Date) out[k] = v.toISOString();
        else if (Array.isArray(v)) out[k] = v;
        else if (v && typeof v === "object" && k !== "related")
          out[k] = v; // keep nested raw; related handled separately
        else out[k] = v;
      }
      return out;
    };
    const baseObj = isServiceAdmin ? row : rest;
    const baseNorm = normalizeDates(baseObj);
    if (Array.isArray(baseObj["related"])) {
      baseNorm["related"] = baseObj["related"] || [];
    }
    return baseNorm;
  }
}

export default MemoryService;
