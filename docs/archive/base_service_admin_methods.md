### BaseService Admin Methods — Proposal (opt‑in)

Purpose: Provide a minimal, safe, and reusable set of admin/public ops that any service can opt into with one call in its constructor, reusing BaseService CRUD and eventing.

Scope: Generic across services backed by a Prisma model with an `id` column. Keeps defaults conservative; services can override hooks to restrict fields and extend filters.

Key constraints

- **Event naming**: `${serviceName}:<method>`
- **Ack semantics**: success returns `{ success: true, data }`; errors are mapped to `{ success: false, error, code? }` and client helpers resolve `data` or `undefined`.
- **Access levels**: `Read < Moderate < Admin` (service-level via `socket.serviceAccess[serviceName]`) and optional entry ACLs when `hasEntryACL`.
- **Opt-in**: Services must call `this.installAdminMethods(options)` in their constructor. No methods are auto-exposed by default.

Installation (service constructor)

```ts
// inside e.g. UserService constructor after super(...)
this.installAdminMethods({
  expose: {
    list: true,
    get: true,
    create: false, // default false; enable per-service when safe
    update: true,
    delete: false, // default false; enable per-service when safe
    setEntryACL: this.hasEntryACL, // only if table stores entry ACLs
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
```

Provided methods (payloads/responses)

- **adminList** (`${serviceName}:adminList`)

  - Access: Moderate
  - Payload: `{ page?: number; pageSize?: number; sort?: { field?: "createdAt"|"updatedAt"|"id"; direction?: "asc"|"desc" }; filter?: { id?: string; ids?: string[]; createdAfter?: string; createdBefore?: string; updatedAfter?: string; updatedBefore?: string } }`
  - Response: `{ rows: T[]; page: number; pageSize: number; total: number }`
  - Behavior: server-side pagination with safe default sort (`updatedAt desc`). Filters are limited to safe built-ins; services may extend via hook.

- **adminGet** (`${serviceName}:adminGet`)

  - Access: Moderate
  - Payload: `{ id: string }`
  - Response: `T | undefined`

- **adminCreate** (`${serviceName}:adminCreate`)

  - Access: Admin
  - Payload: `{ data: Partial<InsertT> }`
  - Response: `T`
  - Behavior: fields sanitized via `sanitizeAdminCreateData`; emits update.

- **adminUpdate** (`${serviceName}:adminUpdate`)

  - Access: Moderate (service-level) or entry ACL (when `hasEntryACL`) if service-level insufficient and updating self-like entries is allowed by override
  - Payload: `{ id: string; data: Partial<InsertT> }`
  - Response: `T | undefined`
  - Behavior: fields sanitized via `sanitizeAdminUpdateData`; emits update.

- **adminDelete** (`${serviceName}:adminDelete`)

  - Access: Admin
  - Payload: `{ id: string }`
  - Response: `{ id: string; deleted: true }`
  - Behavior: calls BaseService `delete`; emits `{ id, deleted: true }`.

- **adminSetEntryACL** (`${serviceName}:adminSetEntryACL`) — only when `hasEntryACL`

  - Access: Admin
  - Payload: `{ id: string; acl: Array<{ userId: string; level: "Read"|"Moderate"|"Admin" }> }`
  - Response: `T | undefined`
  - Behavior: updates row `acl` JSON; emits update.

- **adminGetSubscribers** (`${serviceName}:adminGetSubscribers`)

  - Access: Admin
  - Payload: `{ id: string }`
  - Response: `{ id: string; subscribers: Array<{ socketId: string; userId?: string }> }`
  - Behavior: returns current subscriber snapshot from in-memory `subscribers` map.

- **adminReemit** (`${serviceName}:adminReemit`)

  - Access: Admin
  - Payload: `{ id: string }`
  - Response: `{ emitted: boolean }`
  - Behavior: reads current row and re-emits `${serviceName}:update:${id}` with latest data (no mutation).

- **adminUnsubscribeAll** (`${serviceName}:adminUnsubscribeAll`)
  - Access: Admin
  - Payload: `{ id: string }`
  - Response: `{ id: string; unsubscribed: number }`
  - Behavior: drops all subscribers for an entry.

BaseService additions (internal helpers/hooks)

- `installAdminMethods(options)` — attaches selected admin methods to the concrete service instance using `definePublicMethod`, ensuring ServiceRegistry discovery without changing the registry.
- Access helpers
  - `protected hasServiceAccess(socket: CustomSocket, level: AccessLevel): boolean`
  - `protected isLevelSufficient(userLevel: AccessLevel, required: AccessLevel): boolean`
- Sanitizers (service-overridable)
  - `protected getAdminEditableFields(): string[]` — default: all columns except `id`, `createdAt`, `updatedAt`, `service_access`, `acl`
  - `protected sanitizeAdminCreateData(data: Record<string, unknown>, socket: CustomSocket): Partial<InsertT>`
  - `protected sanitizeAdminUpdateData(data: Record<string, unknown>, socket: CustomSocket): Partial<InsertT>`
  - Defaults: strip disallowed keys, coerce primitives minimally, auto-set `updatedAt` on update, `createdAt`/`updatedAt` on create.
- List hooks (service-overridable)
  - `protected extendAdminListFilter(filter: Record<string, unknown>): Record<string, unknown> | undefined` — return Prisma where-clause addition
  - `protected allowedAdminSortFields(): string[]` — default: `id`, `createdAt`, `updatedAt`

Validation and safety defaults

- Denylist fields: `id`, `createdAt`, `updatedAt`, `service_access` and `acl` unless explicitly allowed by override.
- Filter whitelist: only `id`, `ids`, `createdAt`, `updatedAt` ranges by default.
- Pagination caps: `pageSize` default 25, max 200.
- All mutations check `socket.userId` and service-level access first; when `hasEntryACL`, updates may also allow via entry ACL if service-level insufficient (reuse `checkAccess`).

Logging

- Consistent with server logger policy: `this.logger = logger.child({ service: this.constructor.name })`.
- Emit logs at key points:
  - list/get: `debug` with criteria
  - create/update/delete/setEntryACL: `info` with target id and sanitized fields
  - getSubscribers/reemit/unsubscribeAll: `info` with counts/outcomes

Tests (per service; start with `user`)

- Integration (socket):
  - list/get require Moderate+, create/delete require Admin
  - update allowed for Moderate+; verify entry ACL bypass only when `hasEntryACL` and row grants level
  - setEntryACL only when `hasEntryACL`
  - update/delete trigger `${serviceName}:update:${id}` events
  - getSubscribers/unsubscribeAll/reemit behaviors
- Unit (service-only):
  - `sanitizeAdminCreateData`/`sanitizeAdminUpdateData` strip denied fields
  - `hasServiceAccess`/`isLevelSufficient`

Implementation plan (incremental)

1. Add helpers/hooks to `BaseService` (no public methods yet).
2. Implement `installAdminMethods(options)` attaching selected methods using `definePublicMethod` and delegating to helpers.
3. Wire UserService to call `installAdminMethods` with a conservative matrix (no create/delete at first).
4. Add integration tests under `server/src/services/user/__tests__/admin.int.test.ts` covering access and behavior.
5. Optionally expose shared client types for admin methods later if needed by an admin UI.

Notes

- We intentionally avoid changing `ServiceRegistry` to traverse prototype chains; attaching methods to the instance via `installAdminMethods` keeps discovery unchanged and explicit per service.
- Filters are intentionally minimal and safe; services that need richer querying should override hooks or add service-specific admin methods.
