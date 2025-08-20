## Side Project Framework: Strategy and Setup

### Goal

Create a second project that reuses this repo's framework (server↔client socket pattern, shared types, BaseService, auto-glue, hooks, Socket\* inputs, rules) without overcomplicating day-to-day development.

This document is agnostic: it defines the core framework you keep and a fast, repeatable playbook to prune everything else at any time, regardless of what extra services exist.

### Core catalog (keep these)

- Core Server (framework + essential services)

  - Framework and infra (not business-specific):
    - `server/src/core/**` (e.g., `baseService.ts`, `serviceRegistry.ts`)
    - `server/src/mcp/**` (e.g., `registry.ts`)
    - `server/src/utils/logger.ts`, `server/src/middleware/auth.ts`
    - `server/src/types/**` (socket/service types if present)
    - `server/src/db/**`, `server/src/index.ts`, `server/src/config/**`
  - Essential services for user + AI chat flows:
    - `server/src/services/account/**`
    - `server/src/services/session/**`
    - `server/src/services/user/**`
    - `server/src/services/chat/**`
    - `server/src/services/message/**`
    - `server/src/services/agent/**`
    - `server/src/services/model/**`
  - Tests only for the above core services and framework helpers under `server/src/__tests__/`
  - Prisma schema models to keep: `User`, `Account`, `Session`, `VerificationToken`, `Model`, `Agent`, `Chat`, `Message`
  - Optional: `Memory` service and model can be kept if your side project benefits from persistent memory, but it is not required for the minimal chat loop.

- Core Client (hooks + socket + shared UI)

  - Socket provider and primitives:
    - `client/app/socket/SocketProvider.tsx`
    - `client/app/hooks/useServiceMethod.ts`, `client/app/hooks/useSubscription.ts`
    - `client/app/hooks/types.ts` (trim to core services)
  - Shared UI foundation and socket-aware inputs:
    - `client/app/components/**` (display, inputs, layout, utils)
    - `client/app/test-components/**` (kept for quick UI smoke testing)
  - Service hooks for core services only (e.g., `hooks/user`, `hooks/chat`, `hooks/message`, `hooks/agent`, `hooks/model`)

- Core Shared
  - `shared/types.ts` re-exporting Prisma types and socket DTOs only for core models/services you keep.

Everything not listed above is considered non-core and is safe to delete during pruning.

### Options to maintain two projects

1. Template repo (leanest, manual backports)

- What: Mark this repo as a template or create a trimmed "starter" branch; generate new repos from it. When framework improvements happen, cherry-pick into the other repo(s).
- Pros: Lowest process overhead; simple mental model; no package publishing.
- Cons: Manual syncing when BaseService/hooks change; drift risk as projects evolve.
- Best when: You value speed and the second project is smaller/experimental.

2. Extract a shared framework package (moderate upfront work)

- What: Move common pieces into a separate repo with Yarn workspaces packages:
  - `@beatsage/shared-types` (Prisma types re-export + socket types)
  - `@beatsage/server-core` (BaseService, ServiceRegistry, MCPRegistry, logger, middleware, core types)
  - `@beatsage/client-core` (SocketProvider, `useServiceMethod`, `useSubscription`, Socket inputs)
  - Optional: `@beatsage/rules` (Cursor rules and docs)
- Publish privately (GitHub Packages) or consume via git tags.
- Pros: One source of truth; updates land in both projects via semver bump.
- Cons: Upfront extraction/refactor; versioning and release discipline required.
- Best when: Framework churn is frequent and you want painless reuse.

3. Single monorepo, multi-app (max reuse, heavier structure)

- What: Host both apps in one monorepo: `apps/beatsage` and `apps/sidegame`, sharing `packages/*` for core.
- Pros: No cross-repo syncing; single typecheck/lint/test; best DX once set up.
- Cons: Bigger repo; CI more complex; app boundaries blur unless disciplined.
- Best when: You actively work on both apps and want tight sharing.

4. Git submodule/subtree for framework (niche)

- What: Extract `framework/` and include via git submodule or subtree.
- Pros: Keeps a single source without a registry.
- Cons: Developer friction (submodule ergonomics); not as smooth as package deps.
- Best when: You’re comfortable with advanced git flows and want repo pinning.

### Recommendation

- Start with Option 1 (Template repo). It’s the least friction and matches the goal of not overcomplicating. Revisit Option 2 once you feel pain syncing BaseService/hooks across repos (rule of thumb: >3 cross-ports/month).
- Keep a lightweight "porting playbook" (below) so backports are quick and consistent.

### Initial setup: create the second project (Template path)

1. Create a template source

- Option A: Mark this repo as a GitHub Template and create a `starter` branch that already excludes `oanda`, `project`, `task`.
- Option B: Clone this repo locally, prune non-core services, then push as a new repo.

2. Agnostic pruning playbook (LLM-ready, < 30 minutes)

- Discover non-core services (server):
  - List service directories under `server/src/services/*` and mark any that are NOT in the core catalog above as non-core.
  - Examples of typically non-core: `instrument`, `order`, `oanda`, `project`, `task`, or any domain-specific folder you added.
- Remove non-core service code (server):
  - Delete entire non-core service folders from `server/src/services/<service>`.
  - Update `server/src/services/index.ts` to stop importing/instantiating removed services.
  - Remove non-core tests: delete files in `server/src/__tests__/services/*` that reference removed services.
- Prisma schema cleanup:
  - Open `prisma/schema.prisma` and delete models/enums that belong to removed services.
  - Ensure the core models remain: `User`, `Account`, `Session`, `VerificationToken`, `Model`, `Agent`, `Chat`, `Message`. Keep `Memory` only if you want memory features.
  - Run:
    ```bash
    yarn prisma:generate
    yarn db:push
    ```
- Shared types and client type maps:
  - Edit `shared/types.ts` to remove re-exports and DTOs for removed models/services.
  - Edit `client/app/hooks/types.ts` to remove non-core services from `ServiceMethodsMap` and `SubscriptionDataMap`.
- Client hooks and UI cleanup:
  - Delete hook folders under `client/app/hooks/<service>` for removed services.
  - Search UI for references to removed services (nav, pages, demos) and delete or adjust.
  - Keep `client/app/components/**` and `client/app/test-components/**` intact.
- Docs cleanup:
  - Remove `docs/services/<service>.md` pages for removed services.
- Validate and fix imports:
  - Use search to find residual references to removed services and delete or update.
    ```bash
    rg "(instrumentService|orderService|projectService|taskService|oanda)" -n
    ```
  - Repeat for any other non-core service names you removed.

3. Rename packages

- In root `package.json` and each workspace `package.json`, rename from `@beatsage/*` to your new scope (e.g., `@sidegame/*`).
- Search for the old scope in import paths and update.

4. Environment and scripts

- Keep the same scripts; adjust app name and ports if desired.
- Set environment variables in `~/.zshrc` (do not paste inline): DB URLs, NextAuth, API keys you actually need.

5. Validate

- From the repo root: `yarn`, `yarn prisma:generate`, `yarn db:push`, `yarn typecheck`, `yarn lint`, `yarn test`.
- Start dev: `yarn dev`. Verify server hot reload via `yarn logs:recent`.

### Porting playbook (manual backports, ~5 min)

Scope of changes that are worth porting between repos:

- `server/src/core/**` (BaseService, ServiceRegistry)
- `server/src/mcp/**` (MCPRegistry)
- `server/src/utils/logger.ts`
- `server/src/middleware/auth.ts`
- `server/src/types/**` (if present)
- `shared/**` (types)
- `client/app/socket/**`, `client/app/hooks/**`, `client/app/components/inputs/**`
- `.cursor-rules.md` and `.cursor/rules/**`

Steps to pull a specific improvement from Repo A into Repo B:

1. In Repo B, add Repo A as a remote and fetch:

```bash
git remote add beatsage <git-url-to-repo-A>
git fetch beatsage
```

2. Cherry-pick the commit(s) that touched only the framework paths above (or use `git range-diff` to inspect a PR):

```bash
git cherry-pick -x <commit_sha>
```

3. Resolve conflicts, run `yarn typecheck && yarn lint && yarn test`, commit.

Tip: Prefer small PRs that isolate framework changes from feature code; makes cherry-picks trivial.

### When to graduate to a shared framework package (Option 2)

- You’ve ported >3 framework changes in a month.
- BaseService or hook contracts need coordinated update in both projects.
- You want third projects to reuse the stack.

Minimal extraction map if/when you do it:

- `packages/shared-types` → exports Prisma types + socket DTOs from `shared/` and `server/src/types/socket`.
- `packages/server-core` → `server/src/core/**`, `server/src/mcp/**`, `server/src/utils/logger.ts`, `server/src/middleware/auth.ts`.
- `packages/client-core` → `client/app/socket/**`, `client/app/hooks/**`, `client/app/components/inputs/**`.
- Both apps depend on these packages via workspaces or GitHub package registry.

### Side project task checklist (Template path)

- Repo created from template/starter
- Services pruned; schema updated
- Client hook type maps updated (`client/app/hooks/types.ts`)
- Tests adjusted; all green: `yarn test`
- Typecheck/lint pass: `yarn typecheck`, `yarn lint`
- Dev boot and smoke test chat/memory flow
- Document unique services you add under `docs/services/<your-service>.md`

### Notes

- Core service set for minimal chat loop: `account`, `session`, `user`, `chat`, `message`, `agent`, `model`.
- `memory` is optional; include it if your project benefits from persistent memory.
- Less code > more new code: reuse BaseService and hooks as-is where possible.
- Keep components under 500 lines; extract subcomponents.
- Centralize style in `client/app/theme.ts`; prefer MUI defaults.
