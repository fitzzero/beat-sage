# Beat Sage

## Overview

Rhythm-based cultivation game built as a full-stack monorepo using Yarn Workspaces (Next.js client + Express/Socket.io server). Prisma (`prisma/schema.prisma`) is the single source of truth for the database schema.

## Environment Variables (Local dev on macOS zsh)

Copy and paste the following into your `~/.zshrc` file, replace placeholders with actual values, then run `source ~/.zshrc` to apply. These are for local development; for production on Ubuntu, set similar user/environment variables.

```bash
export DATABASE_URL="postgres://username:password@localhost:5432/beatsage_development"
export DATABASE_URL_TEST="postgres://username:password@localhost:5432/beatsage_test"
# PostgreSQL connection string
export NEXTAUTH_URL="http://localhost:3000"  # Client URL for NextAuth
export NEXTAUTH_SECRET="generate-a-strong-random-secret-here"  # Secret for NextAuth session encryption
export GOOGLE_CLIENT_ID="your-google-client-id-here"
export GOOGLE_CLIENT_SECRET="your-google-client-secret-here"
export OPENAI_API_KEY="your-openai-api-key-here"
export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
export SERVER_PORT="4000"  # Port for the Express/Socket.io server
export CLIENT_PORT="3000"  # Port for the Next.js client (default)
export ENABLE_DEV_CREDENTIALS="true"  # Optional: enable local email signin for tests (never set in prod)
```

Notes:

- Generate `NEXTAUTH_SECRET` using `openssl rand -base64 32` or similar.
- Ensure PostgreSQL is running and create `beatsage_development` and `beatsage_test` databases.
- `ENABLE_DEV_CREDENTIALS=true` enables a Credentials provider locally for quick sign-in and test auth.
- Prisma is the single source of truth for schema and types. Generated client is used in server code; `shared/types.ts` re-exports Prisma types for the client.

## Quickstart

1. Install deps

```
yarn
```

2. Ensure database and run Prisma generate and push

```
yarn prisma:generate
yarn db:push
yarn db:seed
```

3. Start dev servers (client + server)

```
yarn dev
```

Client: `http://localhost:${CLIENT_PORT}` (default 3000)

Server logs: `yarn logs:recent`

## Development Commands

- Monorepo: `yarn dev`, `yarn build`, `yarn clean`
- Typecheck: `yarn typecheck` (server+client)
- Lint: `yarn lint` (server+client)
- Tests: `yarn test` (server integration/unit)
- E2E (Playwright MCP): `yarn test:e2e` or `yarn test:e2e:ui`

### Server-only

- `yarn dev:server`, `yarn workspace @beatsage/server start`
- DB (Prisma): `yarn prisma:generate`, `yarn db:push`, `yarn db:migrate:dev`, `yarn db:seed`, `yarn db:studio`
- Logs: `yarn logs`, `yarn logs:recent`, `yarn logs:today`, `yarn logs:clean`

### Client-only

- `yarn dev:client`, `yarn workspace @beatsage/client build`, `yarn workspace @beatsage/client start`

ESLint is configured for both workspaces; run from root for consistency.

## Project Structure

### Root

```
beat-sage/
├── client/              # Next.js client application
├── server/              # Express/Socket.io server
├── docs/                # Documentation and plans
├── scripts/             # Utility scripts (e.g., MCP tools)
├── .cursor-rules.md     # Overview; detailed rules in .cursor/rules/*.mdc
├── .eslintrc.json       # ESLint configuration
├── .gitignore           # Git ignore rules
├── package.json         # Root monorepo package.json with workspaces
├── README.md            # This file
└── tsconfig.json        # Root TypeScript configuration
```

### Client Structure

```
client/
├── app/                 # Next.js app router directory (pages, components, etc.)
├── package.json         # Client-specific package.json with scripts
└── tsconfig.json        # Client-specific TypeScript config extending root
```

### Server Structure (high-level)

```
server/
├── src/
│  ├── core/             # BaseService, ServiceRegistry
│  ├── services/         # Service folders (e.g., user/) with public methods
│  ├── prisma/           # Prisma schema and migrations
│  ├── db/               # DB helpers (ensure, seed, testDb)
│  ├── middleware/       # Socket auth
│  └── __tests__/        # Unit + integration tests
├── package.json
└── tsconfig.json
```

## Testing

- Unit + integration (server): `yarn test` (Jest). Integration tests spin up an ephemeral Socket.io server and connect with `socket.io-client`. Local auth shortcuts are enabled when `ENABLE_DEV_CREDENTIALS=true`.
- E2E (optional): `yarn test:e2e` (Playwright MCP).

## Logging

- Human + JSON logs written to `server/logs/combined.log`. Prefer: `yarn logs:recent`.
- When editing server code during dev, confirm hot reload via logs before restarting.

## Architecture & Conventions

- Plan: `docs/plans/full_stack_setup.md`
- Service architecture: `.cursor/rules/service-architecture.mdc`
- Server workflow: `.cursor/rules/server-workflow.mdc`
- Client UI: `.cursor/rules/client-ui.mdc`
- Service hooks: `.cursor/rules/service-hooks.mdc`
