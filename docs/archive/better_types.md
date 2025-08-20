## Better typing for BaseService and public service methods

### Problems observed (today)

- **Duplication of method shapes**: Services redeclare payload/response types inline rather than reusing `shared/ProjectServiceMethods`, `TaskServiceMethods`, etc. This enables drift.
- **No compile-time guarantee on handler return types**: `server/src/types/socket.ts` erases generics to `unknown`, so even if `definePublicMethod<P, R>` is parameterized, the registry path treats handlers as `(unknown) => Promise<unknown>`.
- **Excessive `unknown` and bracket access**: Patterns like `this.db["project"] as unknown as { findUnique... }` proliferate. Linter is flagging unsafe assignments/returns in `project/index.ts` and `task/index.ts`.
- **BaseService CRUD return types are weak**: `create/update/delete` are typed with `Record<string, unknown>` which forces downstream `as` casts.
- **Inconsistent use of BaseService vs direct Prisma**: Some services (e.g., `chat`) call `prisma.*` directly for writes, bypassing auto-emit and type unification.

### Goals

- **Single source of truth** for public method payload/response types via `shared/*ServiceMethods`.
- **Compile-time enforcement** that handlers return the declared response type.
- **Prisma-first types** for model entities and inputs; remove most `unknown` and `as unknown as`.
- **Cleaner DB access** without `this.db["model"]` bracket/`unknown` casts.
- **Typed BaseService helpers** so services don’t have to type around internals.

### Proposed type architecture

1. Introduce generics to the service layer consistently

   - `BaseService<TModelName, TEntity, TCreateInput, TUpdateInput, TServiceMethods>`
     - `TModelName` extends `keyof PrismaClient` (e.g., "project").
     - `TEntity` is the Prisma row type (e.g., `Project`).
     - `TCreateInput` and `TUpdateInput` are Prisma’s inputs (e.g., `Prisma.ProjectCreateInput`, `Prisma.ProjectUpdateInput`).
     - `TServiceMethods` is the corresponding `shared/*ServiceMethods` map for this service.

2. Add a typed delegate on BaseService

   - `protected get delegate(): PrismaClient[TModelName]` to eliminate `this.db["model"]` usage.
   - Services will use `this.delegate.findUnique(...)` for typed reads not covered by wrappers.

3. Strongly type BaseService CRUD and common reads

   - `protected async create(data: TCreateInput): Promise<TEntity>`
   - `protected async update(id: string, data: TUpdateInput): Promise<TEntity | undefined>`
   - `protected async delete(id: string): Promise<void>`
   - `protected async findUnique(where: WhereUniqueFor<TModelName>): Promise<TEntity | null>`
   - `protected async findMany(args: FindManyArgsFor<TModelName>): Promise<TEntity[]>`
   - Helper type utilities (`WhereUniqueFor`, `FindManyArgsFor`) derive from the model delegate’s method signatures via indexed access types.

4. Make `ServiceMethodDefinition` generic and preserve types end-to-end

   - In `server/src/types/socket.ts`:
     - `export type ServiceMethodDefinition<P, R> = { name: string; access: string; handler: (payload: P, socket: CustomSocket) => Promise<R>; resolveEntryId?: (payload: P) => string | null };`
     - `export type ServiceMethodHandler<P, R> = (payload: P, socket: CustomSocket) => Promise<R>;`
   - `ServiceRegistry` can accept `ServiceMethodDefinition<unknown, unknown>` for runtime wiring while services keep compile-time safety.

5. Convenience factory to avoid redeclaring payload/response in services

   - Add to `BaseService` a wrapper constrained by the service’s method map:
     - `defineMethod<K extends keyof TServiceMethods>(name: K, access: AccessLevel, handler: (payload: TServiceMethods[K]["payload"], socket: CustomSocket) => Promise<TServiceMethods[K]["response"]>, options?)`.
   - Services then write: `this.defineMethod("updateProject", "Moderate", async (payload) => { ... })` with types pulled from `shared/ProjectServiceMethods`.

6. Event payload validation (optional, later)
   - Optionally attach a Zod schema per method for runtime validation and safe parsing: `{ schema?: z.ZodType<P> }`. Not required to meet current goals; include in a later phase.

### Example: ProjectService after changes

```ts
// server/src/services/project/index.ts (sketch)
import type { Prisma, Project } from "@prisma/client";
import type { ProjectServiceMethods } from "@shared/types";

export default class ProjectService extends BaseService<
  "project",
  Project,
  Prisma.ProjectCreateInput,
  Prisma.ProjectUpdateInput,
  ProjectServiceMethods
> {
  constructor() {
    super({
      model: "project",
      hasEntryACL: true,
      serviceName: "projectService",
    });
    this.installAdminMethods({
      /* unchanged policy config */
    });
  }

  public updateProject = this.defineMethod(
    "updateProject",
    "Moderate",
    async (payload) => {
      const updated = await this.update(payload.id, payload.patch);
      return { project: updated };
    },
    { resolveEntryId: (p) => p.id }
  );

  public getProject = this.defineMethod(
    "getProject",
    "Read",
    async (payload) => {
      const row = await this.findUnique({ id: payload.id });
      return { project: row ?? undefined };
    },
    { resolveEntryId: (p) => p.id }
  );
}
```

- No manual payload/response redeclaration; types come from `ProjectServiceMethods`.
- No `this.db["project"]` or `unknown as` casts.
- Handler return type is enforced by `defineMethod` to match `response`.

### Migration plan (phased, low risk)

- Phase 1: Type plumbing

  - Update `server/src/types/socket.ts` to generic `ServiceMethodDefinition<P, R>` and `ServiceMethodHandler<P, R>`.
  - Update `BaseService.definePublicMethod` to return `ServiceMethodDefinition<P, R>` explicitly.
  - Keep `ServiceRegistry` runtime-wiring unchanged but typed as `ServiceMethodDefinition<unknown, unknown>`.

- Phase 2: BaseService ergonomics

  - Add `delegate` getter and typed CRUD/read wrappers (`create`, `update`, `delete`, `findUnique`, `findMany`).
  - Change internal uses in `BaseService` (e.g., `subscribe` and ACL helpers) to use `delegate` and derived types instead of `Record<string, unknown>`.
  - Narrow `emitUpdate` payload type to `Partial<TEntity>`.

- Phase 3: Service refactors

  - Refactor `project`, `task`, `chat` services to:
    - Use `delegate` or `findUnique/findMany` for reads.
    - Use BaseService `create/update/delete` for writes (fix `chat` which bypasses BaseService).
    - Replace `definePublicMethod<P, R>` with `defineMethod<K extends keyof TServiceMethods>` to eliminate local type duplication.
    - Replace `unknown`/`as unknown as` casts.

- Phase 4: Prisma-first input types

  - Where appropriate, use `Prisma.*CreateInput`/`Prisma.*UpdateInput` for method payloads in `shared/types.ts` (or `Pick<>` of those to scope the surface area). Example:
    - `ProjectServiceMethods.updateProject.payload.patch: Pick<Prisma.ProjectUpdateInput, "title" | "description" | "status" | "assignedAgentId">`.
  - For cases where user-friendly primitives are desired (e.g., `dueAt: string`), keep `shared` types ergonomic and perform conversion in the service.

- Phase 5: Lint and guardrails
  - Add ESLint rules (or a local rule via ban-types/ban-ts-comment) to flag:
    - `this.db["*"]` in `server/src/services/**`.
    - `as unknown as` in service code.
  - Monorepo checks continue to gate: `yarn typecheck:server`, `yarn lint:server`, `yarn test:server`.

### Acceptance criteria

- Services do not redeclare payload/response shapes; they reference `shared/*ServiceMethods` only.
- Handlers that return the wrong type fail TypeScript in the service file.
- No `this.db["model"]` or `unknown as` patterns remain in service code.
- BaseService `create/update/delete/findUnique/findMany` are typed and used consistently for writes; direct Prisma writes in services are removed.
- Linter is clean in `server/src/services/**` and integration tests still pass.

### Work items

- [ ] types/socket: make `ServiceMethodDefinition` generic; adjust registry references
- [ ] core/baseService: `delegate` getter + typed CRUD/read wrappers; narrow `emitUpdate` types
- [ ] core/baseService: add `defineMethod<K>()` constrained by service method map
- [ ] shared/types: optionally refine patches with `Pick<Prisma.*UpdateInput, ...>` where appropriate
- [ ] services(project/task/chat): refactor to use new helpers; remove `unknown`/bracket access
- [ ] lint rules: forbid `this.db["*"]` and `as unknown as` in services
- [ ] run `yarn typecheck:server && yarn lint:server && yarn test:server`

### Notes

- We deliberately keep the server-side runtime wiring permissive (payloads are `unknown` at the socket boundary). Compile-time correctness is enforced in each service via `defineMethod` and the shared method map.
- Optional future improvement: add per-method Zod schemas for runtime validation and typed parsing of payloads before invoking handlers.

### Phase 6: Rule updates and enforcement

- Update `.cursor-rules.md` to reference service typing best practices and ensure the rules file links to `.cursor/rules/service-architecture.mdc` for details.
- Update `.cursor/rules/service-architecture.mdc` to include:
  - Require services to use `defineMethod<K extends keyof TServiceMethods>` and `shared/*ServiceMethods` for method typing.
  - Require BaseService typed helpers (`delegate`, `create`, `update`, `delete`, `findUnique`, `findMany`) over bracket access (`this.db["model"]`).
  - Ban `as unknown as` in `server/src/services/**`; prefer proper generics and Prisma types.
  - Require all write operations to go through BaseService; if a different emit target is needed, extend BaseService rather than bypassing it.
  - Favor Prisma input types (e.g., `Prisma.ProjectUpdateInput`) or `Pick<>` thereof for payload patches in `shared/types.ts`.
  - Keep runtime socket boundary permissive; compile-time method typing is mandatory.
  - CI checks: `yarn typecheck:server`, `yarn lint:server`, `yarn test:server` must pass before commit.

### Service conformance audit checklist

Apply to each service under `server/src/services/<name>/`.

- Method typing

  - Uses `defineMethod<K>()` and pulls payload/response from `shared/*ServiceMethods`.
  - Handler return type matches `response` (compile-time enforced).

- BaseService usage

  - All writes use `this.create/update/delete` (no direct `prisma.*`).
  - Reads use `this.delegate` or `findUnique/findMany` (no `this.db["model"]`).
  - No `as unknown as` in service code.

- Access control

  - `ensureAccessForMethod` is respected via registry.
  - Service-level `checkAccess` override implemented where needed; entry-level ACLs rely on BaseService.

- Payload hygiene

  - Patch types sourced from Prisma inputs or `Pick<>`s; conversions (e.g., string to Date) are done in handler.
  - Admin methods installed with appropriate `access` and sanitize helpers.

- Events and subscriptions

  - Emits use BaseService’s emit path; if cross-entity emit is required, service extends BaseService to support custom emit target instead of bypassing writes.
  - Subscription event names match `${serviceName}:update:${entryId}` convention.

- Quality gates
  - Typecheck/lint/tests pass (`yarn typecheck:server && yarn lint:server && yarn test:server`).

Per-service audit pass

- account
  - Adopt generics and delegate; ensure any future writes use BaseService.
- agent
  - Replace direct `prisma.*` writes with BaseService writes; remove `unknown` casts.
- chat
  - Replace direct `prisma.*` writes with BaseService writes; introduce BaseService extension if chat-level emit is needed; remove `unknown` casts.
- instrument
  - Remove `this.db["instrument"|"candle"]` bracket access; add typed repo or use `delegate` helpers; keep writes via BaseService.
- memory
  - Replace bracket/`unknown` patterns with typed delegate and repo; ensure all writes use BaseService; return DTOs consistently.
- message
  - Avoid direct `prisma.*` writes; either route through BaseService or extend BaseService to emit on chat-level while writing message rows.
- model
  - Ensure `recordUsage` uses typed `update`; reduce `unknown` casts (e.g., bigint increments) via Prisma types or helpers.
- oanda
  - Ensure metadata writes use typed BaseService helpers; remove bracket access in `ensureAccountRow`.
- order
  - Pure façade over HTTP client; no direct DB writes; keep method typing consistent.
- project
  - Switch to `defineMethod<K>()` and typed helpers; remove bracket access; ensure payload patch uses Prisma types.
- session
  - Adopt generics and delegate for future DB reads; keep method typing consistent.
- task
  - Switch to `defineMethod<K>()`; remove bracket access; ensure patch conversions (dates) are explicit and typed.
