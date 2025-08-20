## Goal

Create a full stack project (Server <--> Client) that's easy for a single (LLM) developer to maintain

## Definitions

- Service: Represents a table in the database and maintains how to interface with it
  - User Service: Handle auth and settings for Users
    - Account Service
    - Session Service
  - Agent Service: Handle settings and llm model selection for AI Agents
  - Chat Service: Handle chat rooms between Users and Agents
    - Message Service: Handle messages for a Chat
  - Model Service: Handle collection of available models and usage for Agents
  - Memory Service: Handle LLM focused memories to add to context for Agents
- Entry: A single row within the table
- ACL: Access Control List
  - Collection of ACE
  - ACL per Service
  - Optional ACL per Entry
- ACE: Access Control Entry
  - Simple levels enum [Read, Moderate, Admin]

### Server

Express, Socket.io, Prisma (PostgreSQL)
Modern TS Config, Strict Linting

- Services that maintain the source of truth of all data & business logic
- Services extend a BaseService class that comes with a bunch of features to maintain consistency and speed up development
  - Options for passing in the schema of the Entries
  - Options for if Entries will have their own ACL or inherit a parents ACL
  - Out of the box public Subscription method (option to define ACE level)
    - Allows users (that meet ACL reqs) to subscribe to realtime updates of the Entry
  - Out of the box private methods to expedite Service (CRUD + Other Helpers)
    - Create, Update, Delete methods should auto io.emit updates to Subscribed users
  - Pattern for defining public methods for users to access
    - Define: Access (Public or ACL Level), Payload, Response
    - Out of the box logging for the method for easier and consistent debugging
    - Auto glue for socket.io to listen for defined methods
    - Auto glue for client to be able to interface with methods
    - Auto glue for MCP Tools to be able to interface with methods
- Integration Test Framework using a Client Socket to test Services
- Socket.io server to maintain the bridge between Client and Services

### Client

Next.JS, Next Auth, Material UI

- App router
- MUI Theme Provider
- Auth Provider for handling Sessions
- Socket Provider for connecting to server (and authenticating if Session exists)
- useServiceMethod - Hook for interfacing with defined Service public methods utilizing the in context Socket. Can be wrapped for simplicity ie `useChatCreate = useServiceMethod(...)`
  - Utilize useSWR or other custom framework to standardize request, loading, return states
- useSubscription - Hook for subscribing to real time updates of an Entry
  - Utilize useSWR or Context Providers to ensure if two components each subscribe to the same entity, both share the same subscription

### Project Setup

Local: MacOS utilizing node v22.18
Production: Ubuntu Server LTS utilizing node v22.18

- Origin: github.com/fitzzero/beat-sage
- Yarn or Yarn Workspace
- Clean Yarn package scripts to achieve common tasks and dev patterns
- Env variables
  - For local dev utilize Mac zch variables
  - For production utilize Ubuntu Server user variables
- Modern best practices for tsConfig and easy ways to check type/build
- Strict linting in Client & Server and easy ways to manage/check lint
- Clear, concise .cursor-rules to ensure llms stay consistent
- Do add comments that add evergreen context for future LLMs or bookmark areas that may need future adjustment
- Don't add comments that won't help long term such as project/task phases
- Utilize `/docs` to maintain context of architecture, plans
- Utilize `/scripts/mcp` to create any Cursor specific MCP bridges to assist with local development

### Rules

- Try to stick with framework best modern practices (Next.js, Socket.io, Prisma, etc)
- Client
  - Avoid css/tailwind/untyped styling
  - Focus on functionality and layout when first developing new features
  - Save styling for polish passes on exising/working features or unless requested
    - Utilize MUI Theme and Theme Variables for consistency
- Server
  - Functionality that other services might use should try to be abstracted to core
  - Apply a consistent logger util (Winston) that will allow an LLM to understand state and history of server events easily
  - Avoid creating duplicate methods that achieve the same thing, ie an MCP Tool creating a memory and a Client UI input creating a memory should utilize the same Service method (with different auto glue / middleware)

## Additional Context

- Database: Use PostgreSQL with Prisma as the ORM; Prisma Client provides type-safe queries and a single schema source at `prisma/schema.prisma`.
- Authentication: Implement Next-Auth with credentials provider for user authentication, integrating seamlessly with the User Service on the server.
- Monorepo Structure: Use Yarn Workspaces to manage server and client in a single repository for easier dependency management and development.
- Versions: Target Node.js v22.x, Next.js v14.x, Express v4.x, Socket.io v4.x, Prisma v6.x, Material-UI v5.x.
- Logging: Implement Winston for consistent server-side logging as specified.
- Testing: Focus on integration tests using Socket.io client simulations.
- Deployment: Local dev on MacOS, production on Ubuntu; use PM2 or similar for Node process management in production.
- Security: Ensure ACL enforcement in all public methods; use HTTPS for Socket.io in production.

This additional context builds on the original plan to make implementation more concrete while maintaining flexibility.

## Happy Path Example (Refined)

1. **Connection & Auth:**

   - Client connects via Socket.io to server
   - Server extracts userId from auth token/session in connection middleware
   - Socket.userId is set for all subsequent operations

2. **Auto-Service Registration:**

   - Server automatically registers all service public methods as socket listeners
   - Event naming: `"userService:updateUser"`, `"userService:subscribe"`, etc.
   - All methods wrapped with standardized response handling

3. **Client Subscription:**

   - `useSubscription("userService", userId)` leverages SWR-like patterns for deduplication
   - Multiple components using same subscription share single socket listener
   - BaseService handles subscription ACL checking and socket management
   - Auto-cleanup when all subscribed components unmount

4. **Method Invocation:**

   - `useServiceMethod("userService", "updateUser")` calls server method
   - Server validates access, executes `this.update()`, returns standardized response
   - Errors only returned to method caller, not broadcast to subscribers

5. **Real-time Propagation:**
   - BaseService.update() automatically emits to all subscribers via `update:${entryId}` events
   - Client components using `useSubscription` receive updates instantly
   - SWR-like state management handles deduplication and cache invalidation

## High-Level Phases Checklist

- [x] Phase 1: Initialize Repository - Set up GitHub repo, Yarn Workspaces, basic directory structure (server, client, docs, scripts), tsconfig, linting, .cursor-rules, and package scripts.
- [x] Phase 2: Configure Environment - Set up env variables for local (MacOS zsh) and production (Ubuntu), including database connection strings.
- [x] Phase 3: Server Setup - Install Express, Socket.io, Drizzle, PostgreSQL driver; configure DB connection and migrations.
- [x] Phase 4: Implement BaseService - Develop the BaseService class with schema options, ACL handling, subscription support, CRUD methods, and public method patterns.
- [x] Phase 5: Implement Core Services - Build User, Account, Session, Agent, Chat, Message, Model, Memory Services extending BaseService.
- [x] Phase 6: Socket.io Integration - Set up Socket.io server with authentication middleware and auto-glue for service methods.
- [x] Phase 7: Client Setup - Install Next.js, Next-Auth, Material-UI; configure app router, theme provider, auth provider, socket provider.
- [x] Phase 8: Client Hooks - Implement useServiceMethod and useSubscription hooks, integrating with SWR for state management.
- [x] Phase 9: Authentication Bridge - Connect Next-Auth sessions with Socket.io authentication.
- [x] Phase 10: Testing Framework - Set up integration tests using Socket.io client to verify services.
- [ ] Phase 11: Documentation and Polish - Update /docs with architecture details, ensure linting and type checks, add logging throughout.
- [x] Phase 12: Review and Iterate - Test full stack flow, ensure real-time updates work, validate ACLs, and prepare for production deployment.

This checklist provides a sequential guide to building the project, ensuring all key areas are covered for a feasible and maintainable architecture.
