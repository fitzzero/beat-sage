## Integration & E2E Test Plan (Phase 10)

### Goals

- Validate service behavior end-to-end via Socket.IO (client ↔ server ↔ DB)
- Exercise ACL paths (Admin, Moderate, Regular)
- Verify subscriptions and real-time propagation
- Keep tests fast, hermetic, and minimal setup

### Scope

- Client-socket integration tests for all public service methods
- Server unit/integration tests for internal helpers (non-public methods)
- UI tests (Playwright) deferred until later

### Test Data & Seeding

- Seed the test database with 3 users (only for NODE_ENV=test):

  - Admin user: service-level ACE = `Admin` for every active service
  - Moderate user: service-level ACE = `Moderate` for every active service
  - Regular user: no service-level ACE; only default Entry ACE (e.g., can manage own `user` entry)

- Reset strategy per test suite:
  - Before each suite: drop/recreate or truncate relevant tables; re-seed the 3 users and any required entities
  - Keep seeding centralized (e.g., `server/src/__tests__/seed.ts`)

### Auth Strategy (Tests)

- Local dev (fastest): set `ENABLE_DEV_CREDENTIALS=true` and use the dev-only `auth.userId` handshake for seeded users

  - Pros: zero OAuth/cookie deps, simplest for local runs
  - Usage: `ioClient(url, { auth: { userId: SEEDED_USER_ID } })`
  - Ensure this flag is never set in production

- CI (recommended): use the short-lived `socketToken` auth path without OAuth
  - Mint tokens in tests using `NEXTAUTH_SECRET`
  - Provide token in `auth.socketToken`
  - Keeps CI closer to prod verification without relying on cookies

Notes:

- Tests should never rely on browser cookies or NextAuth OAuth flow
- Keep all secrets/env in the test runner shell; do not inline in tests

### Test Runner & Commands

- Use Jest in the server workspace (already configured)
- Scripts:
  - Lint: `yarn lint:server`
  - Typecheck: `yarn typecheck:server`
  - Tests: `yarn test:server`

### Socket Test Harness

- Start the Socket.IO server on an ephemeral port in `beforeAll`, and close in `afterAll`
- Use `socket.io-client` to create connections with `auth: { socketToken }`
- Provide utilities in `server/src/__tests__/utils/socket.ts`:
  - `startTestServer()` → returns `{ io, httpServer, port }`
  - `connectAsUser(userId)` → returns a connected `clientSocket`
    - If `ENABLE_DEV_CREDENTIALS=true`, use `{ auth: { userId } }`
    - Else mint a short-lived `socketToken` and use `{ auth: { socketToken } }`
  - `emitWithAck(client, event, payload)` → Promise wrapper for ack pattern
  - `waitFor(clientOrServerSocket, event)` → Promise that resolves on first event

### Example: UserService E2E (public updateUser)

Cases:

- Admin can update any user (service-level `Admin`)
- Moderate can update any user (service-level `Moderate`)
- Regular can update themselves (self ACL)
- Regular cannot update another user
- Regular cannot update with invalid payload (validation failure)
- Regular subscribes to self and receives updates when their profile changes

Outline:

1. `beforeAll`:
   - start server, determine port
   - seed DB with Admin/Moderate/Regular + 1 additional Regular as the target
2. `it` blocks:
   - Connect as Admin → call `userService:updateUser` on target → expect success
   - Connect as Moderate → same → expect success
   - Connect as Regular A → update Regular A → expect success
   - Connect as Regular A → update Regular B → expect 403/insufficient permissions
   - Connect as Regular A → update with invalid fields → expect 400/validation error
   - Subscription test:
     - Connect as Regular A → subscribe to `userService` with `entryId = userA.id`
     - In parallel, update userA from Admin
     - Expect client to receive `${serviceName}:update:${entryId}` with new data

### Service Coverage

- For each service in `server/src/services/`:
  - Enumerate all public methods (auto-discovered by ServiceRegistry)
  - Create a spec file `server/src/__tests__/[service]Service.int.test.ts`
  - Include ACL-positive, ACL-negative, validation, and subscription tests as applicable

### Server Unit Tests

- Tests for core and utility modules (no sockets):
  - ACL helpers
  - Validation utilities
  - Service private methods (CRUD guards, emit behavior mocked)
  - Logger behavior (smoke-level)

### Test Utilities (proposed files)

- `server/src/__tests__/setup.ts` (already exists): global Jest setup
- `server/src/__tests__/seed.ts`: seed/drop helpers for test DB
- `server/src/__tests__/utils/socket.ts`: Socket server and client helpers

### Env & CI Notes

- Set `NODE_ENV=test`
- Provide `NEXTAUTH_SECRET`, `DATABASE_URL_TEST` in CI environment
- Do NOT set `ENABLE_DEV_CREDENTIALS` in CI unless using the dev handshake fallback

### Runbook

1. `yarn typecheck:server && yarn lint:server`
2. `yarn test:server`
3. If debugging locally, tail logs: `tail -100 server/logs/combined.log`

### Next Steps

- Implement `seed.ts`, `utils/socket.ts`, and the first E2E spec for `UserService`
- Expand to other services and keep tests minimal/representative
