"use client";

import React from "react";
import * as THREE from "three";
import { Icons } from "@client/app/lib/icons";

type Beat = {
  index: number;
  timeMs: number;
  direction: string;
  holdMs: number;
};
type GameRendererProps = {
  className?: string;
  beats?: Beat[];
  effectiveStartMs?: number;
};

export default function GameRenderer({
  className,
  beats = [],
  effectiveStartMs,
}: GameRendererProps) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const timelineStartMsRef = React.useRef<number | null>(null);
  const TRAVEL_SECONDS = 4.0;

  // Establish a stable timeline start time when inputs change
  React.useEffect(() => {
    if (beats.length === 0) {
      timelineStartMsRef.current = null;
      return;
    }
    const minBeat = Math.min(...beats.map((b) => b.timeMs));
    if (typeof effectiveStartMs === "number") {
      // Align so the earliest beat sits at the right edge initially
      timelineStartMsRef.current =
        effectiveStartMs - TRAVEL_SECONDS * 1000 + minBeat;
    } else {
      // Fallback preview: show earliest beat at right immediately
      timelineStartMsRef.current = Date.now() + TRAVEL_SECONDS * 1000 - minBeat;
    }
  }, [effectiveStartMs, beats]);
  // Snapshot wiring placeholders (to be connected next)
  // const [instanceId, setInstanceId] = React.useState<string | null>(null);
  // const latestSnapshot = React.useRef<import("@shared/types").InstanceSnapshot | null>(null);
  // const lastUpdateMs = React.useRef<number>(performance.now());

  React.useEffect(() => {
    if (!mountRef.current) {
      return () => undefined;
    }

    const container = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 2.25, -2.25, 0.1, 100);
    camera.position.set(0, 0, 10);

    // Simple ambient light for completeness
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const textureLoader = new THREE.TextureLoader();
    const texUp = textureLoader.load(Icons.UP);
    const texDown = textureLoader.load(Icons.DOWN);
    const texLeft = textureLoader.load(Icons.LEFT);
    const texRight = textureLoader.load(Icons.RIGHT);

    const plane = new THREE.PlaneGeometry(0.35, 0.35);

    function createInstancedArrows(
      texture: THREE.Texture,
      trackY: number,
      count: number
    ) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
      });
      const mesh = new THREE.InstancedMesh(plane, material, count);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        dummy.position.set(2, trackY, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      return mesh;
    }
    // Top -> Bottom order: Left, Up, Down, Right (shifted upward to leave room for HUD)
    const trackYs = [2.0, 1.3, 0.6, -0.1];
    const arrowsLeft = createInstancedArrows(texLeft, trackYs[0], 28);
    const arrowsUp = createInstancedArrows(texUp, trackYs[1], 28);
    const arrowsDown = createInstancedArrows(texDown, trackYs[2], 28);
    const arrowsRight = createInstancedArrows(texRight, trackYs[3], 28);
    scene.add(arrowsLeft, arrowsUp, arrowsDown, arrowsRight);

    // Static left indicators for hit timing
    const indicatorSize = new THREE.PlaneGeometry(0.35, 0.35);
    const indLeft = new THREE.Mesh(
      indicatorSize,
      new THREE.MeshBasicMaterial({ map: texLeft, transparent: true })
    );
    const indUp = new THREE.Mesh(
      indicatorSize,
      new THREE.MeshBasicMaterial({ map: texUp, transparent: true })
    );
    const indDown = new THREE.Mesh(
      indicatorSize,
      new THREE.MeshBasicMaterial({ map: texDown, transparent: true })
    );
    const indRight = new THREE.Mesh(
      indicatorSize,
      new THREE.MeshBasicMaterial({ map: texRight, transparent: true })
    );
    indLeft.position.y = trackYs[0];
    indUp.position.y = trackYs[1];
    indDown.position.y = trackYs[2];
    indRight.position.y = trackYs[3];
    scene.add(indLeft, indUp, indDown, indRight);

    const start = performance.now();
    const dummy = new THREE.Object3D();

    function tick() {
      const nowMs = performance.now();
      const t = (nowMs - start) / 1000;
      // Scroll arrows right -> left, and align one instance per track when beat data available
      const trackList = [arrowsLeft, arrowsUp, arrowsDown, arrowsRight];
      const span = Math.max(0.5, camera.right - camera.left - 0.8);
      const startX = camera.right - 0.4;
      // Choose beats per track
      const byDir: Record<string, number[]> = {
        Left: [],
        Up: [],
        Down: [],
        Right: [],
      };
      // Use stable timeline start
      const startAt = timelineStartMsRef.current;
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        (byDir[b.direction] ?? byDir.Left).push(b.timeMs);
      }
      const dirs = ["Left", "Up", "Down", "Right"] as const;
      trackList.forEach((instanced, trackIdx) => {
        const y = trackYs[trackIdx];
        const times = byDir[dirs[trackIdx]];
        const count = instanced.count;
        // When no beats, fall back to decorative flow
        if (!times || times.length === 0) {
          for (let i = 0; i < count; i++) {
            const base = (i / count) * span;
            const xRaw = startX - ((t + base) % span);
            dummy.position.set(xRaw, y, 0);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
          }
          instanced.instanceMatrix.needsUpdate = true;
          return;
        }
        // Map upcoming beats to positions. Hit location is leftX.
        const leftX = camera.left + 0.5;
        const pixelsPerSecond = (startX - leftX) / TRAVEL_SECONDS; // travel time
        const nowServerMs = Date.now();
        const visibleWindow = TRAVEL_SECONDS * 1000; // show full travel time
        let placed = 0;
        for (let i = 0; i < times.length && placed < count; i++) {
          if (!startAt) {
            break;
          }
          const beatTime = startAt + times[i];
          const dt = beatTime - nowServerMs;
          // Skip only when the beat has been offscreen to the left longer than full travel time
          if (dt < -TRAVEL_SECONDS * 1000) {
            continue; // already passed long ago
          }
          if (dt > visibleWindow) {
            break; // too far in future
          }
          const x = leftX + (dt / 1000) * pixelsPerSecond;
          dummy.position.set(x, y, 0);
          dummy.updateMatrix();
          instanced.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
        // If nothing placed yet (beats are far), show decorative flow so the track is visible
        if (placed === 0) {
          for (let i = 0; i < count; i++) {
            const base = (i / count) * span;
            const xRaw = startX - ((t + base) % span);
            dummy.position.set(xRaw, y, 0);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
          }
        } else {
          // Fill remaining with offscreen
          for (let i = placed; i < count; i++) {
            dummy.position.set(10000, 10000, 0);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
          }
        }
        instanced.instanceMatrix.needsUpdate = true;
      });

      // TODO: When hooked to snapshot, adjust positions from authoritative data updated at 10 TPS,
      // and keep this loop at 60fps for smooth visuals.
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }

    let raf = requestAnimationFrame(tick);

    function onResize() {
      if (!container) {
        return;
      }
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      const viewHeight = 4.5; // fixed world height
      const viewWidth = viewHeight * aspect;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      // position indicators at left edge and align Y with tracks
      const leftX = camera.left + 0.5;
      indLeft.position.set(leftX, trackYs[0], 0);
      indUp.position.set(leftX, trackYs[1], 0);
      indDown.position.set(leftX, trackYs[2], 0);
      indRight.position.set(leftX, trackYs[3], 0);
    }

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    onResize();

    // Keyboard input for attemptBeat (emit CustomEvent for host to forward)
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key;
      if (
        key === "ArrowLeft" ||
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowRight"
      ) {
        window.dispatchEvent(
          new CustomEvent("bs-attempt-beat", {
            detail: { direction: key, clientBeatTimeMs: Date.now() },
          })
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      container.removeChild(renderer.domElement);
      renderer.dispose();
      plane.dispose();
      scene.clear();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [beats, effectiveStartMs]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    />
  );
}
