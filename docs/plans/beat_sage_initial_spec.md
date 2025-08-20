## Goal

Create a web based rhythm based game utilizing the mono repo full stack framework.

## Services

- characterService (1 user to many characters)
  - Created by a user to act as their avatar
  - Props include
    - Name
    - HealthCurrent
    - HealthMax
    - ManaCore (manaService relation)
    - User (userService relation)
    - Skills (skillService relation)
    - Online (boolean)
- manaService (1 character to 1 mana)
  - Props include
    - Current
    - Maximum
    - Experience
    - Rate
    - Max Rate
- skillService (1 character to many skills)
  - Props include
    - Character // who's skill is it
    - Mastery //number
    - Name
    - ManaCost
    - Damage
    - Cooldown
    - LastCast (To double check if cooldown has passed)
    - TotalCasts (fun stat)
    - Priority // number, unique (only 1 skill for a player can be priority 1, can be set to null which is its inactive state)
    - TargetPriority // Enum
      - [Closest, Highest Health, Lowest Health, Furthest]
- genreService (skills and eventually other services will reference this music genre)
  - Props to include
    - Name
    - Description
- partyService (group of characters)
  - Props to include
    - Host (character relation, character can only host one party at a time so this should be unique)
    - Character (character relation, character can only be in one party at a time so this should be unique)
    - Ready //boolean of ready state, join Instance when all are ready
    - Instance (instantService relation) // Where the party is
- instanceService (a live game with the party with a start and end)
  - Props to include
    - Location (locationService relation)
    - CreatedAt
    - EndedAt
    - Party (partyService relation) // Who is at the location
    - Mobs (instanceMobService relation)
    - Song (songService relation)
- instanceMobService (which mobs are active or killed in this instance)
  - Props to include
    - Mob (mobService relation)
    - HealthCurrent (calculated health mob spawns in with)
    - Status // dead or alive
    - ManaCurrent
    - Xp (How much xp to grant per 1 damage)
    - Damage (How much damage to deal per attack)
    - Distance (How close to player are they)
- locationService (map of different locations parties can venture to)
  - Props to include
    - Name
    - Coordinates
    - Image
    - Difficulty // number
    - Mobs (mobService relationship, who can spawn)
- mobService (enemies that can spawn in a location)
  - Props to include
    - Name
    - Image
    - HealthBase
    - HealthyMultiplier //How much to multiply health on spawn based on Instance difficulty mob spawns in
    - DamageBase
    - DamageMultiplier // How much to multiply damage on spawn based on Instance difficulty mob spawns in
    - XpBase // XP to grant per 1 damage taken
    - XpMultiplier // How much to multiply xp per damage taken
    - SpawnRate // Chance to spawn
    - SpawnRateMultiplier // How much to increase chance based on difficulty
- songService (A song to be played in an instance)
  - Name
  - Genre (generService relation)
  - Src (file location of the song to play)
  - BeatMap (Array of Beats)
    - Direction (Up, Down, Left, Right)
    - Time (in ms)
    - Hold (duration in ms)

## Happy Path (how all the services play together)

1. User creates a new character (characterService)
2. Character is granted a mana core (manaService)
3. Character is granted starter hard coded skills (skillService)
   - Can adjust skills to active (setting a priority 1-8) or inactive
4. Character is assigned to their own party of 1 (partyService)
   - Can invite or join other parties if they wish
5. User can select a Instance for their party (instanceService)
6. User can select a Song for their party (songService)
7. User can set their status to ready (partyService)
8. Once party instance & song chosen and party is ready, Instance begins (instanceService)
   - Due to the live nature of instances, may make sense to maintain state in memory while active, only periodically saving state to database
   - inMemory state should send similar socket.emit updates as baseService.update (so that subscribed clients can still get real time info even if database isn't updating in real time)
9. Instance has a warmup phase
10. Instance then tells client to start the song
    - Characters must follow a 'DDR inspired' beatmap which starts to follow the beatmap at the same time the song begins
    - Characters send their 'beats' (beatmap inputs) to the instance to be graded on accuracy (in relation to when client started the song, not when server did)
    - Instance then updates characters mana and mana rate based on accuracy
      - Perfect/Marvelous: ±16-33ms (most strict) (+1 mana rate)
      - Great/Perfect: ±50-66ms
      - Good: ±100-116ms
      - Bad/OK: ±150-166ms (-1 mana rate)
      - Miss: Outside of ±150-200ms (-1 mana rate)
11. InstanceMobs then begin to spawn per Instance and Mob rules (instanceMobService)
    - Mobs move forward at a set rate (reducing distance to player)
    - If mobs reach player, they apply their damage every 2 seconds
12. Client will monitor the state of active skills and mana, firing skills off when possible. IE if their priority 1 skill is off cooldown, they have enough mana, attempt to cast the skill with the instanceService
    - Instance service verifies they can cast the skill
      - Meets mana requirements
      - now() - skill.lastCast > skill.cooldown
    - Updates player mana and skill lastCast
    - Applies skill damage to the mob that best satisfies the skills targetPriority (ie applies 5 damage to mob with lowest distance if targetPriority was closest)
    - Grants player mana core the experience for the damage (damage x active mob xp)
13. Instance continues until song is completed or all players are dead

## Vision

- Players can create magical characters
- The only way to grow in power is to slay magical beasts for experience and loot
- The only way to generate mana is by staying on the beat
- Characters can cultivate affinities with different music generes
- Characters can group up in parties and join instances together
- Instances are a 'DDR esque' game where characters must all complete the same Song sequence to the best of their ability, using their generated mana and casted skills to stay alive
- Staying alive awards players with experience, loot, and high scores to grow more powerful and take on harder areas and harder songs.

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

- Beat grading

  - Windows (tunable): Perfect ±33ms (+1 rate), Great ±66ms (0), Good ±116ms (0), Bad ±166ms (−1), Miss >200ms (−1).
  - Update mana.rate clamped [0, maxRate]; update mana.current clamped [0, maximum]; emit mana + instance updates.

- Mobs and damage

  - Mobs advance by distance per tick; on proximity, apply periodic damage.
  - castSkill reduces mob health; on death, mark Dead, grant XP (damage × xpPerDamage).

- Persistence
  - Keep active state in memory for ticks; persist on key events and on end.

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
