## Goal

Build a co-op DDR-style rhythm cultivation game on our monorepo. This spec is the single source of truth for schema, services, realtime flows, and delivery stages.

## Vision (brief)

- Generate mana by hitting beats; spend mana on skills to survive and progress.
- Co-op parties run song-based instances; accuracy drives combat outcomes.
- Progression via XP, difficulty, and content unlocks.

## Comprehensive MVP Spec (LLM-executable)

### Architecture & Conventions

- Monorepo: Next.js client (`client/`), Express/Socket.IO server (`server/`), shared types (`shared/`), managed with Yarn Workspaces.
- Prisma: single source of truth at `prisma/schema.prisma`.
- Services: follow `BaseService` from `server/src/core/baseService.ts` and rules in `service-architecture`.
  - Each service folder: `server/src/services/<service>/` with `index.ts` and `methods/*.ts`.
  - Public methods registered via `defineMethod` and return via `exactResponse`.
  - Mutations use `this.create|update|delete` to auto-emit updates; reads use Prisma delegates.
- Realtime: Subscriptions emit `${serviceName}:update:${entryId}`. Game loop publishes instance state and mana deltas on ticks.
- Tests: Integration tests for public methods under `server/src/__tests__/services/`; unit tests for pure helpers (beat grading, cooldown checks, targeting).

### Prisma Data Model (MVP)

- Character

  - userId (User), name, online (Boolean)
  - relations: Mana (1:1), Skills (1:n), PartyMember (n:1)
  - indexes: userId, name

- Mana

  - characterId (unique), current, maximum, experience, rate, maxRate

- Skill

  - characterId, name, manaCost, damage, cooldownMs, lastCastAt?, mastery, totalCasts
  - priority (Int?, null=inactive); unique on (characterId, priority) when priority not null
  - targetPriority (Enum: Closest | HighestHealth | LowestHealth | Furthest)

- Genre

  - name (unique), description?

- Song

  - name, genreId, src

- SongBeat

  - songId, index, timeMs, direction (Enum: Up | Down | Left | Right), holdMs (default 0)
  - unique: (songId, index)

- Location

  - name, coordinates?, image?, difficulty

- Mob

  - name, image?, healthBase, healthMultiplier, damageBase, damageMultiplier, xpBase, xpMultiplier, spawnRate, spawnRateMultiplier

- Party

  - hostCharacterId (Character), status (Enum: Lobby | Ready | InInstance | Complete)

- PartyMember

  - partyId, characterId, isReady (Boolean default false)
  - unique: (partyId, characterId); unique: (characterId)

- Instance

  - partyId, locationId, songId, status (Enum: Pending | Active | Complete | Failed), startedAt?, endedAt?

- InstanceMob
  - instanceId, mobId, healthCurrent, status (Enum: Alive | Dead), distance, xpPerDamage, damagePerHit

Notes

- IDs are UUIDs; timestamps use createdAt/updatedAt.
- Index all foreign keys and frequently filtered fields.

#### Reference Prisma schema (MVP)

```prisma
// Enums
enum Direction {
  Up
  Down
  Left
  Right
}

enum TargetPriority {
  Closest
  HighestHealth
  LowestHealth
  Furthest
}

enum PartyStatus {
  Lobby
  Ready
  InInstance
  Complete
}

enum InstanceStatus {
  Pending
  Active
  Complete
  Failed
}

enum MobStatus {
  Alive
  Dead
}

model Character {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  name      String
  online    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id])
  mana      Mana?
  skills    Skill[]
  members   PartyMember[]

  @@index([userId])
}

model Mana {
  id          String   @id @default(uuid()) @db.Uuid
  characterId String   @unique @db.Uuid
  current     Int      @default(0)
  maximum     Int      @default(100)
  experience  Int      @default(0)
  rate        Int      @default(0)
  maxRate     Int      @default(5)

  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
}

model Skill {
  id            String         @id @default(uuid()) @db.Uuid
  characterId   String         @db.Uuid
  name          String
  manaCost      Int
  damage        Int
  cooldownMs    Int
  lastCastAt    DateTime?
  mastery       Int            @default(0)
  totalCasts    Int            @default(0)
  priority      Int?
  targetPriority TargetPriority
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  character     Character      @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@unique([characterId, priority])
  @@index([characterId])
}

model Genre {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique
  description String?
  songs       Song[]
}

model Song {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  genreId   String   @db.Uuid
  src       String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  genre     Genre    @relation(fields: [genreId], references: [id])
  beats     SongBeat[]
}

model SongBeat {
  id       String    @id @default(uuid()) @db.Uuid
  songId   String    @db.Uuid
  index    Int
  timeMs   Int
  direction Direction
  holdMs   Int       @default(0)

  song     Song      @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@unique([songId, index])
  @@index([songId])
}

model Location {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  coordinates String?
  image       String?
  difficulty  Int
  instances   Instance[]
}

model Mob {
  id                 String   @id @default(uuid()) @db.Uuid
  name               String
  image              String?
  healthBase         Int
  healthMultiplier   Decimal
  damageBase         Int
  damageMultiplier   Decimal
  xpBase             Int
  xpMultiplier       Decimal
  spawnRate          Float
  spawnRateMultiplier Float
  instanceMobs       InstanceMob[]
}

model Party {
  id               String      @id @default(uuid()) @db.Uuid
  hostCharacterId  String      @unique @db.Uuid
  status           PartyStatus @default(Lobby)
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  host             Character   @relation(fields: [hostCharacterId], references: [id])
  members          PartyMember[]
  instances        Instance[]
}

model PartyMember {
  id           String    @id @default(uuid()) @db.Uuid
  partyId      String    @db.Uuid
  characterId  String    @unique @db.Uuid
  isReady      Boolean   @default(false)

  party        Party     @relation(fields: [partyId], references: [id], onDelete: Cascade)
  character    Character  @relation(fields: [characterId], references: [id])

  @@unique([partyId, characterId])
  @@index([partyId])
}

model Instance {
  id          String         @id @default(uuid()) @db.Uuid
  partyId     String         @db.Uuid
  locationId  String         @db.Uuid
  songId      String         @db.Uuid
  status      InstanceStatus @default(Pending)
  startedAt   DateTime?
  endedAt     DateTime?

  party       Party          @relation(fields: [partyId], references: [id])
  location    Location       @relation(fields: [locationId], references: [id])
  song        Song           @relation(fields: [songId], references: [id])
  mobs        InstanceMob[]

  @@index([partyId])
  @@index([locationId])
  @@index([songId])
}

model InstanceMob {
  id            String     @id @default(uuid()) @db.Uuid
  instanceId    String     @db.Uuid
  mobId         String     @db.Uuid
  healthCurrent Int
  status        MobStatus  @default(Alive)
  distance      Int
  xpPerDamage   Int
  damagePerHit  Int

  instance      Instance   @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  mob           Mob        @relation(fields: [mobId], references: [id])

  @@index([instanceId])
  @@index([mobId])
}
```

### Services and Public Methods (MVP)

- characterService

  - createCharacter: { name } → { id }
  - updateCharacter: { id, patch: { name?, online? } } → Character | undefined
  - listMine: { page?, pageSize? } → Character[]
  - subscribe: { id } → Character | null

- manaService

  - subscribe: { characterId } → { current, maximum, rate, maxRate, experience }

- skillService

  - listMySkills: { characterId } → Skill[]
  - updateSkill: { id, patch: { priority?, name?, manaCost?, damage?, cooldownMs? } } → Skill | undefined

- genreService

  - listAll: {} → Genre[]

- songService

  - listSongs: { genreId?, page?, pageSize? } → Array<{ id, name, genreId }>
  - getSongBeats: { songId } → Array<{ index, timeMs, direction, holdMs }>

- locationService

  - listLocations: { page?, pageSize? } → Array<{ id, name, difficulty }>

- partyService

  - createParty: { hostCharacterId } → { id }
  - joinParty: { partyId, characterId } → { id }
  - leaveParty: { partyId, characterId } → { id }
  - setReady: { partyId, characterId, isReady } → { partyId, characterId, isReady }
  - subscribe: { partyId } → { hostCharacterId, members: Array<{ characterId, isReady }> }

- instanceService
  - createInstance: { partyId, locationId, songId } → { id, status: "Pending" }
  - subscribe: { id } → { status, startedAt?, songId, locationId, mobs: InstanceMob[], party: { memberIds } }
  - attemptBeat: { id, characterId, clientBeatTimeMs } → { grade: "Perfect" | "Great" | "Good" | "Bad" | "Miss", manaDelta: number, rateDelta: number }
  - castSkill: { id, characterId, skillId } → { ok: boolean; reason?: string }

Access control

- Self actions (listMine, own subscriptions): Read for authenticated users.
- Cross-entry actions (joinParty, setReady, createInstance, castSkill): Moderate; enforce party membership.
- Entry ACLs optional later (`hasEntryACL: true`) for instance/party if needed.

### Realtime and Game Loop

- Start

  - When all members ready, create Instance (Pending → Active), emit update with `syncStartAtMs` so clients align playback.

#### Instance lifecycle (authoritative states)

- Status values: `Pending` → `Active` → (`Complete` | `Failed`).
- Transitions:
  - Create sets `Pending` with `startedAt = null`.
  - Start sets `Active` with `startedAt = now()` and begins fixed-tick emissions.
  - End sets `Complete` or `Failed` and stops emissions except on lifecycle events.
- Emission policy by state:

  - `Pending`: emit on events only (subscribe, membership changes, admin updates).
  - `Active`: emit snapshot on a fixed cadence (e.g., 10 TPS) and on important events (mob death, joins/leaves if allowed, casts).
  - Terminal: emit final snapshot on transition, then quiescent.

- Beat grading

  - Windows (tunable): Perfect ±33ms (+1 rate), Great ±66ms (0), Good ±116ms (0), Bad ±166ms (−1), Miss >200ms (−1).
  - Update mana.rate clamped [0, maxRate]; update mana.current clamped [0, maximum]; emit mana + instance updates.

- Mobs and damage

  - Mobs advance by distance per tick; on proximity, apply periodic damage.
  - castSkill reduces mob health; on death, mark Dead, grant XP (damage × xpPerDamage).

- Persistence
  - Keep active state in memory for ticks; persist on key events and on end.

Authoritative realtime model (implementation guidance)

- Instance as source of truth while Active

  - While `Instance.status = Active`, the authoritative combat state (mobs array, per-member battle stats like mana/rate/cooldowns) lives in memory inside `instanceService`.
  - DB writes are throttled: write on lifecycle transitions (Pending→Active, mob death, end), and periodically (e.g., every 5–10s) for durability. Avoid per-tick DB writes.

- Subscription strategy

  - Single subscription: `instanceService:subscribe { id } → InstanceSnapshot`
    - Snapshot includes: `{ status, startedAt, songId, locationId, mobs, party: { memberIds }, members?: Array<{ characterId, mana: { current, maximum, rate, maxRate }, cooldowns?: Record<skillId, remainingMs> }> }`.
    - Emit on fixed cadence (tick), e.g., 10 TPS. Consider deltas later; start with full snapshot for simplicity.
  - Optional supplemental subscriptions (only if needed): `manaService`/`characterService` for non-instance UIs. During Active, instance emits are sufficient for the runner UI.

- Emission cadence

  - Fixed TPS (e.g., 10) during Active; drop to onEvent for Pending/Complete.
  - On critical events (member join/leave, mob death), emit immediately in addition to cadence.

#### Snapshot contract (stability and shape)

- Contract is forward-compatible and stable for the MVP. Required keys:
  - `status: Instance["status"]`
  - `startedAt?: Date | null` (null while `Pending`; set once on `Active` and remains stable)
  - `songId: string`
  - `locationId: string`
  - `mobs: InstanceMob[]` (authoritative per-tick state)
  - `party: { memberIds: string[] }` (stable ordering not guaranteed)
  - `membersMana?: Array<{ characterId: string; current: number; maximum: number; rate: number; maxRate: number; experience: number }>`
- Stability guarantees during `Active`:
  - `startedAt` does not change after first set.
  - Keys remain present with consistent types across emissions.
  - Additional optional fields may be appended in later stages, preserving existing keys.

#### Structure & maintainability

- Keep pure logic in `logic/` (e.g., `grading.ts`, `tick.ts`) and IO/stateful orchestration in `index.ts`.
- Build initial snapshot via a dedicated `snapshot.ts` to centralize shape.
- In-memory state is the source of truth during `Active`; throttle DB writes to lifecycle and periodic durability intervals.
- Isolate ACL checks in `acl.ts`. Prefer service-level checks over row ACLs at MVP.
- Emit through a single helper to ensure consistent fan-out and payload shape.

- Write policy during loop
  - Update in-memory state every tick; do not call Prisma on every change.
  - At cadence N (e.g., every 5–10s) or on end: batch persist Member mana/XP deltas and mob state.
  - Where historical auditing matters, record compact event logs (optional, future stage).

### Development Stages

- Stage 0: Repo ready (done) – monorepo, logging, tests green, pruning completed.
- Stage 1: Schema + seeds – add models, seed genres/songs/locations/mobs.
- Stage 2: Core services – character/mana/skill/genre/song/location with tests and typed methods.
- Stage 3: Party flow – partyService with create/join/ready/subscribe + tests.
- Stage 4: Instance scaffolding – instanceService create/subscribe + lifecycle broadcasts.
- Stage 5: Beat loop – implement attemptBeat grading + mana adjustments with tests.
- Stage 6: Combat loop – mobs advance, castSkill, damage/XP with tests.
- Stage 7: Client MVP – Characters, Party lobby, pickers, Instance runner; socket hooks.
- Stage 8: Polish – ACLs, performance, observability, error handling.

### Testing Strategy

- Integration: end-to-end emits for public methods, ready-to-start flow, beats grading under timing jitter, casting under cooldown/mana constraints.
- Unit: beat grading, cooldown checks, target selection.
- Helpers: use ephemeral Socket.IO test server; seed users with roles as needed.

### Implementation Notes

- Follow `BaseService` strictly: `defineMethod`, `exactResponse`, and `this.create|update|delete` for mutations.
- Keep `shared/types.ts` as the typed contract for client/server.
- Keep methods small; validate payloads; prefer service-level ACLs initially.

### Out of Scope (MVP)

- Invites/matchmaking, loot/equipment, full tick history persistence, visual beatmap editor.
