### Graphics Architecture (Two-Worlds: WebGL Renderer + MUI HUD)

Goal: Keep the game renderer blazing fast and isolated, while preserving a rich, maintainable HUD using MUI. Avoid TypeScript “union too complex” and ReactSharedInternals pitfalls by strictly separating modules.

---

World A: Pure Three.js Renderer (background)

- Modules in this world import only Three.js (no MUI, no sx, no R3F).
- Client-only dynamic import with ssr: false.
- WebGLRenderer + Scene + Camera + RAF loop.
- Performance practices:
  - Instanced meshes for beat arrows, particles, skills.
  - Merge geometries/material reuse; texture atlases for themed assets.
  - Interpolate visuals at 60fps between 10 TPS server snapshots.
- Assets:
  - SVGs (up.svg/down.svg/left.svg/right.svg) exported to textures.
  - Character/mob images when available; background images.
  - Optional postprocessing (bloom/outline) via raw Three or postprocessing lib (non-React).

World B: MUI HUD (foreground)

- Modules in this world import only MUI/React (no Three, no R3F).
- Renders DOM overlay (absolute-positioned) above the canvas.
- Uses sx freely; theme-aware, responsive.
- Responsibilities:
  - Main character avatar.
  - Health/mana bars; skill bar with cooldown states.
  - Score/XP/combo, notifications, deaths/success.
  - Inventory and interactions.

Host Shell (glue)

- Tiny client component with inline style only (no sx).
- Renders <GameRenderer /> and <div id="hud-root" /> overlay.
- GameHud mounts via React portal into #hud-root.
- Shares state via a neutral store (e.g., Zustand/event emitter). The store must not import MUI or Three.

---

Renderer Layering

- BeatmapLayer: Instanced planes textured with arrow SVGs; x-position by track, y-position by timing offset vs syncStartAtMs.
- CharactersLayer: Billboarded quads or simple meshes (swap to models later). Health/mana bars remain in HUD.
- MobsLayer: Quads/meshes with health bars optionally in-scene (or HUD if preferred). Movement interpolation.
- SkillVfxLayer: GPU-instanced particles for casts/impacts.
- Background: static or parallax quad behind layers.

---

DOM→Texture (optional, for in-GL styled UI)

- For static styled components (e.g., custom arrows): export SVG/PNG and load as texture.
- For dynamic styled widgets: render to image using html-to-image/dom-to-image, upload to CanvasTexture, and update only on content changes (debounce).
- Text: prefer SDF text (troika-three-text) for sharp, dynamic text inside WebGL.

---

Timing & Data Flow

- Server remains authoritative at ~10 TPS; client interpolates at 60fps.
- Use syncStartAtMs to align beat positions; audio starts +5000ms.
- Latency compensation: compute client-time vs. beat expectedTime, emit attemptBeat with clientBeatTimeMs; server validates.

---

Integration with Next.js

- GameRenderer and renderer helpers are client-only modules, dynamically imported with ssr: false.
- MUI HUD lives in separate modules that never import Three.
- The host wrapper uses inline style for positioning and never uses MUI sx to avoid TS union explosions.

---

Minimal Adoption Path

1. Implement GameRenderer (pure Three) with instanced arrows from up/down/left/right.svg.
2. Add GameHud (MUI) as overlay with score/combo and health/mana.
3. Wire to instance snapshots; interpolate mob/beat visuals; emit attemptBeat.
4. Add particles/VFX; optional postprocessing.
5. Consider DOM→Texture baking for any complex in-GL widget.

---

When to revisit alternatives

- Phaser (2D-only) if we abandon WebGL depth/VFX needs.
- Unity if we need editor-driven pipelines and heavy 3D, at the cost of web/Next integration.
