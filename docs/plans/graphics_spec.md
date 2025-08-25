### Graphics stack recommendation (MVP realtime scene)

**TL;DR**: Use Three.js via React Three Fiber (R3F) with `@react-three/drei` and `react-postprocessing`. Add GSAP only for UI/HUD timeline flourishes, not core simulation. This gives excellent Next.js integration, strong ecosystem, and high developer velocity while staying lightweight.

---

### Why this stack

- **Best fit for Next.js + React**: R3F is idiomatic React, easy to drop into the existing client UI and MUI layout. Works well with dynamic imports (CSR-only) to avoid SSR issues.
- **Productivity**: `drei` components (OrbitControls, Instances, Text, Particles, PerformanceMonitor) speed up common tasks. Large pool of examples and prior art.
- **Effects/VFX**: `react-postprocessing` (bloom, godrays, outlines) and `three-stdlib` utilities cover most visual needs without custom shader work. `maath` adds math, easing, noise, and helpers.
- **Performance**: Instanced meshes for notes/particles; fine-grained control in `useFrame`; predictable 60fps loop separate from server 10 TPS tick.
- **LLM familiarity**: Three.js/R3F has the most training data and examples; faster to iterate than OGL/Unity for this use case.

---

### Packages (client workspace)

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `react-postprocessing` and `postprocessing`
- `maath` (optional but handy)
- `gsap` (optional; for UI/HUD timelines, not core scene)

Install later via Yarn Workspaces in the `client/` package.

---

### Integration pattern with Next.js

- Create a canvas-bound scene component and load it with dynamic import (CSR only):

```tsx
// Example: client/app/instance/components/InstanceCanvas.tsx
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";

export default function InstanceCanvas() {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
      <PerformanceMonitor />
      {/* Lights, postprocessing, and scene entities go here */}
    </Canvas>
  );
}
```

```tsx
// Example usage with Next dynamic import (disable SSR)
import dynamic from "next/dynamic";
const InstanceCanvas = dynamic(() => import("./components/InstanceCanvas"), {
  ssr: false,
});

export default function Page() {
  return (
    <div style={{ height: "100vh" }}>
      <InstanceCanvas />
    </div>
  );
}
```

---

### Scene architecture (initial)

- **BeatmapLayer**: Arrow/note lanes; use `InstancedMesh` for beats. Positions derived from audio time and `syncStartAtMs`.
- **CharactersLayer**: Simple rigged or billboarded models for players; minimal idle/cast animations.
- **MobsLayer**: Light animations (idle, hit flash); health as simple bars/billboards.
- **SkillVfxLayer**: Instanced particles, trails, and short post-processing bursts (bloom/outline) on hit.
- **HUD/Overlays**: React DOM or `@react-three/drei` `Html` for beat accuracy feedback, combo/rate indicators.

Implementation notes

- Use `useFrame` for local interpolation/extrapolation between server ticks.
- Use `drei/Instances` for notes/particles to minimize draw calls.
- Keep geometries/materials memoized; mutate instance matrices, not React trees.
- Prefer full snapshot updates from server at 10 TPS; render at 60fps client-side.

---

### Data + timing flow

- Server remains authoritative at ~10 TPS (Instance snapshot). Client renders at 60fps.
- Use `syncStartAtMs` from `instanceService:subscribe` to align song playback and beat positions.
- Interpolate mob positions/HP and character mana/rate locally; reconcile on authoritative updates.
- Latency compensation: derive beat accuracy from client audio clock vs. beat times; server validates `attemptBeat` events.

Hook blueprint (client)

```ts
// Pseudocode: useInstanceSub(id) wraps existing socket subscription util
type InstanceSnapshot = {
  id: string;
  status: "Pending" | "Active" | "Complete" | "Failed";
  startedAt?: string; // ISO
  syncStartAtMs?: number;
  songId: string;
  locationId: string;
  mobs: Array<{
    id: string;
    healthCurrent: number;
    status: "Alive" | "Dead";
    distance: number;
  }>;
  party: { memberIds: string[] };
  members?: Array<{
    characterId: string;
    mana: { current: number; maximum: number; rate: number; maxRate: number };
  }>;
};

function useInstanceSub(instanceId: string) {
  // subscribe to `${serviceName}:update:${instanceId}` and store last snapshot
}
```

---

### Effects and polish (incremental)

- **Postprocessing**: bloom on skill hits, subtle vignette, outlines for selected targets.
- **Particles**: GPU instancing for skill projectiles/impact bursts; limited lifetimes to avoid GC.
- **Beat accuracy feedback**: color-coded hit flashes and easing-based scales at hit location; short GSAP timeline or `maath` easing.

---

### When to choose alternatives

- **Phaser**: Choose if you want a strictly 2D, sprite-first pipeline with built-in tweens and simpler asset workflow. Great for rhythm UIs, but less flexible for 2.5D/3D VFX.
- **GSAP (alone)**: Not a renderer. Use alongside React DOM/Canvas/WebGL for orchestrated UI timelines, not as the core scene tech.
- **OGL**: Minimal WebGL wrapper. Good for bespoke small engines, but fewer examples/docs; slower iteration.
- **Unity**: Heavy, complex CI/WebGL builds, and harder React/Next integration. Overkill for this MVP; avoid unless you need full 3D tooling and editor workflows.
- **Plain Three.js (no R3F)**: Viable, but you’ll reimplement React integration and state wiring that R3F already solves.

Recommendation: default to R3F; use Phaser only if we commit to a purely 2D look.

---

### Minimal adoption path

1. Add deps in `client/` and mount a full-screen `Canvas` via dynamic import.
2. Render a basic BeatmapLayer with instanced arrows synced to a mocked `syncStartAtMs`.
3. Wire to real `instanceService:subscribe`; interpolate between snapshots at 60fps.
4. Add SkillVfx and Mob hit flashes; introduce light postprocessing.
5. Iterate on assets and camera choreography.

---

### Open questions

- Are we targeting a 2D aesthetic (Phaser-like) or 2.5D/3D stylized look?
- Any mobile performance constraints (target devices/FPS)?
- Preference for timeline tooling (GSAP) vs. physics-based or frame-based anim in R3F?
