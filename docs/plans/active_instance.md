# Active Instance Game Loop Plan

## Goal

Transform the pending instance setup into a fully functional co-op rhythm combat game where players hit beats to generate mana and survive waves of advancing mobs. This plan implements the core game loop with real-time synchronization, beat accuracy grading, mana management, and mob combat while maintaining the DDR-style beatmap gameplay.

## Technical Architecture

### Server-Side Game Loop (instanceService)

**Current Implementation Status:**

- ✅ `attemptBeat` method with grading logic (33ms/66ms/116ms/166ms windows)
- ✅ `startInstance` method to transition Pending → Active
- ✅ 10 TPS tick system with mob advancement
- ✅ Contact damage when mobs reach distance 0
- ✅ In-memory state management for active instances
- ✅ Real-time subscription system

**Required Additions:**

- `abandonInstance` method for early termination
- Game over detection (all players at 0 mana)
- Beat timing validation and synchronization
- Song completion detection
- Performance optimizations for high-frequency updates

### Client-Side Game State Management

**Current Implementation Status:**

- ✅ GameContext with party/instance subscriptions
- ✅ Character selection and party management
- ✅ Song/location selection dialogs
- ✅ Ready state management

**Required Additions:**

- Active game screen component with React Three Fiber
- Beat input handling with keyboard/gamepad support
- Audio synchronization and beat timing
- Real-time mana/cooldown visualization
- Performance monitoring and frame rate management

## Acceptance Criteria

### Core Gameplay Flow

- [ ] **Start Conditions**: Host can click "Start Instance" when all party members are ready OR when solo
- [ ] **Timing Precision**: First beat expected exactly 5 seconds after `startedAt` timestamp
- [ ] **Beat Accuracy**: Players graded on client-side timing vs server-validated windows
- [ ] **Mana Management**: Perfect (+1 rate), Great (0), Good (0), Bad/Miss (-1 rate)
- [ ] **Game Over**: Instance transitions to `Failed` when all players reach 0 mana
- [ ] **Song Completion**: Instance transitions to `Complete` when beatmap finishes
- [ ] **Abandon Option**: Host can abandon active instance, setting status to `Failed`

### Real-Time Synchronization

- [ ] **Server Authority**: All game state (mob positions, mana, health) authoritative on server
- [ ] **Client Interpolation**: Smooth 60fps rendering between 10 TPS server updates
- [ ] **Latency Compensation**: Client-side prediction for beat attempts
- [ ] **Reconciliation**: Server corrections applied seamlessly
- [ ] **Connection Recovery**: Re-sync after temporary disconnections

### Performance Requirements

- [ ] **Frame Rate**: Maintain 60fps client-side rendering
- [ ] **Network**: Handle 10 TPS updates with <100ms latency
- [ ] **Memory**: Efficient mob/instance state management
- [ ] **Scalability**: Support multiple concurrent active instances

## Client Display Implementation

### Graphics Architecture (Two-Worlds)

Adopt a strict separation:

- World A (Renderer): Pure Three.js background (no MUI). Instanced beat arrows (from svg textures), characters/mobs, skill VFX, optional postprocessing, and background image.
- World B (HUD): MUI-only foreground overlay for avatar, health/mana, skill bar, score/XP/combo, and notifications.

The host uses inline style only and exposes a portal target for the HUD. Shared state lives in a neutral store used by both worlds.

### Beatmap Rendering

**Beatmap Visualization:**

- Four tracks at x: [-1.5, -0.5, 0.5, 1.5].
- Arrows are instanced planes with up/down/left/right.svg textures.
- Travel timeline derived from syncStartAtMs and audio start (+5000ms). Visual feedback via color/scale and particles.

**Input Handling:** Keyboard + gamepad hooks in the HUD/controller layer, emitting attemptBeat with clientBeatTimeMs.

**Timing Synchronization:**

```tsx
// Server provides syncStartAtMs in instance snapshot
const syncStartAtMs = instance?.startedAt?.getTime();
const audioStartDelay = 5000; // 5 seconds
const effectiveStartTime = syncStartAtMs + audioStartDelay;

// Client-side beat timing
const attemptBeat = (direction, clientTimeMs) => {
  const serverTimeMs = clientTimeMs + timeOffset; // Compensate for latency
  socket.emit("instanceService:attemptBeat", {
    id: instanceId,
    characterId,
    clientBeatTimeMs: serverTimeMs,
  });
};
```

### Characters & Mobs

**Character Display:**

- Characters: billboarded quads or simple meshes; health/mana bars are HUD elements.
- Mobs: meshes/quads advancing by authoritative distance; health bar can be simple in-GL or HUD.

**Mob Display:**

- Mobs spawn on right side, advance leftward toward characters
- Red rectangular hitboxes with health bars
- Distance-based positioning (server distance → client x-coordinate)
- Death animations and spawn effects

**Visual Effects:** Instanced particles, optional bloom/outline; damage numbers via HUD text or SDF text in-scene.

## Server Method Extensions

### New Methods Required

```typescript
// server/src/services/instance/index.ts

// Abandon active instance (host only)
public abandonInstance = this.defineMethod(
  "abandonInstance",
  "Moderate",
  async (payload, socket) => {
    const { id } = payload;
    // Verify host permission
    // Set status to "Failed"
    // Stop tick loop
    // Emit final snapshot
  }
);

// Cast skill (future implementation)
public castSkill = this.defineMethod(
  "castSkill",
  "Read",
  async (payload, socket) => {
    const { id, characterId, skillId } = payload;
    // Validate skill availability and cooldown
    // Apply damage to targeted mob
    // Update mana and cooldowns
  }
);
```

### Enhanced Existing Methods

**startInstance Improvements:**

```typescript
public startInstance = this.defineMethod(
  "startInstance",
  "Read",
  async (payload, socket) => {
    const { id } = payload;

    // Verify all party members are ready
    const partyReady = await checkPartyReady(id);
    if (!partyReady) {
      throw new Error("All party members must be ready to start");
    }

    // Set startedAt and transition to Active
    const updated = await this.update(id, {
      status: "Active",
      startedAt: new Date(),
    });

    // Initialize mana for all party members
    await initializePartyMana(id);

    // Start tick loop
    this.startTickIfNeeded(id);

    return this.exactResponse("startInstance", {
      id,
      status: "Active",
      startedAt: new Date(),
      syncStartAtMs: Date.now() + 5000, // 5 second delay
    });
  }
);
```

## Game State Management

### In-Memory State Structure

```typescript
type ActiveInstance = {
  id: string;
  snapshot: InstanceSnapshot;
  subscribers: Set<CustomSocket>;
  membersMana: Map<string, ManaState>;
  mobStates: Map<string, MobState>;
  beatStates: Map<string, BeatState>;
  ticker?: ReturnType<typeof setInterval>;
};
```

### Tick Loop Logic

```typescript
private async tick(instanceId: string) {
  const rec = this.active.get(instanceId);
  if (!rec) return;

  // 1. Advance mobs toward players
  const advancedMobs = advanceMobs(rec.snapshot.mobs);

  // 2. Apply contact damage
  const damageApplied = applyContactDamage(
    advancedMobs,
    rec.membersMana,
    rec.snapshot.party.memberIds
  );

  // 3. Check for game over conditions
  const allPlayersDead = checkAllPlayersDead(rec.membersMana);
  if (allPlayersDead) {
    await this.endInstance(instanceId, "Failed");
    return;
  }

  // 4. Check for song completion
  const songFinished = checkSongCompletion(rec);
  if (songFinished) {
    await this.endInstance(instanceId, "Complete");
    return;
  }

  // 5. Emit updated snapshot
  rec.snapshot.mobs = advancedMobs;
  this.emitInstanceSnapshot(instanceId);
}
```

## Audio Synchronization

### Beat Timing Strategy

**Server-Side Beat Tracking:**

```typescript
// Track expected beat times based on song data
type BeatState = {
  id: string;
  expectedTimeMs: number;
  direction: Direction;
  isHit: boolean;
  hitBy?: string; // characterId
  hitTimeMs?: number;
  grade?: BeatGrade;
};
```

**Client-Side Audio Management:**

```typescript
// client/app/game/hooks/useAudioSync.ts
const useAudioSync = (instance: InstanceSnapshot) => {
  const audioRef = useRef<HTMLAudioElement>();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (instance?.status === "Active" && instance.startedAt) {
      const startTime = instance.startedAt.getTime() + 5000;
      const delay = startTime - Date.now();

      if (delay > 0) {
        setTimeout(() => {
          audioRef.current?.play();
          setIsPlaying(true);
        }, delay);
      }
    }
  }, [instance?.status, instance?.startedAt]);

  return { isPlaying, audioRef };
};
```

## Error Handling & Recovery

### Network Resilience

- **Connection Loss**: Buffer inputs, attempt reconnection, replay missed actions
- **Server Reconciliation**: Client accepts server corrections gracefully
- **State Desync**: Detect and resync when local state diverges significantly

### Performance Monitoring

- **Frame Rate Tracking**: Monitor and report client performance
- **Network Latency**: Track round-trip times and adjust prediction
- **Memory Usage**: Monitor for memory leaks in long-running instances

## Testing Strategy

### Integration Tests

```typescript
// server/src/__tests__/services/instanceService.active.test.ts
describe("Active Instance Gameplay", () => {
  test("beat timing accuracy affects mana correctly", async () => {
    // Test Perfect/Great/Good/Bad/Miss grading
  });

  test("mob advancement and contact damage", async () => {
    // Test mob movement and damage application
  });

  test("game over conditions trigger correctly", async () => {
    // Test failure when all players die
  });

  test("song completion triggers victory", async () => {
    // Test completion when beatmap ends
  });
});
```

### E2E Tests

```typescript
// playwright-mcp.config.json
{
  "test": "active_game_flow.spec.ts",
  "scenarios": [
    "start_instance_with_multiple_players",
    "beat_accuracy_grading",
    "game_over_on_player_death",
    "song_completion_victory"
  ]
}
```

## Implementation Phases

### Phase 1: Core Game Loop

1. Implement "Start Instance" button with ready check
2. Create active game canvas with basic DDR/RPG layout
3. Add beat input handling and server communication
4. Implement basic mana management and grading

### Phase 2: Combat System

1. Add mob spawning and advancement
2. Implement contact damage
3. Add game over detection
4. Implement abandon functionality

### Phase 3: Polish & Performance

1. Add audio synchronization
2. Implement visual effects and animations
3. Add performance monitoring
4. Optimize rendering and network usage

### Phase 4: Advanced Features

1. Skill casting system
2. Advanced mob AI and targeting
3. Leaderboards and replay system
4. Mobile/touch support

## Success Metrics

- **Performance**: 60fps sustained during active gameplay
- **Synchronization**: <50ms input latency, <100ms state sync
- **Reliability**: <1% desync events, <0.1% game crashes
- **Engagement**: Average session length >5 minutes
- **Accessibility**: Keyboard and gamepad support

This plan provides a solid foundation for the core gameplay loop while maintaining extensibility for future features like skills, advanced mobs, and multiplayer coordination.
