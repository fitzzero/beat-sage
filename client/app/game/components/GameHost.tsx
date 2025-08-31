"use client";

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useGame } from "../GameContext";
import { useAttemptBeat } from "../../hooks/instance/useInstanceMethods";
const GameDebugPanel = dynamic(() => import("./GameDebugPanel"), {
  ssr: false,
});

// Dynamically import the Three renderer (no MUI in this file)
const GameRenderer = dynamic(() => import("./GameRenderer"), {
  ssr: false,
}) as unknown as React.ComponentType<{ className?: string }>;

type GameHostProps = {
  children?: React.ReactNode; // HUD portal can be mounted by a parent
};

export default function GameHost({ children }: GameHostProps) {
  const { instanceId, selectedCharacterId, songBeats, effectiveStartMs } =
    useGame();
  const attemptBeat = useAttemptBeat();
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowDebug(process.env.NODE_ENV !== "production" || params.has("debug"));
  }, []);

  // Bridge CustomEvent from renderer to instanceService.attemptBeat
  useEffect(() => {
    function onAttempt(e: Event) {
      if (!attemptBeat.isReady || !instanceId || !selectedCharacterId) {
        return;
      }
      const detail = (e as CustomEvent).detail as
        | { direction: string; clientBeatTimeMs: number }
        | undefined;
      if (!detail) {
        return;
      }
      void attemptBeat.execute({
        id: instanceId,
        characterId: selectedCharacterId,
        clientBeatTimeMs: detail.clientBeatTimeMs,
      });
    }
    window.addEventListener("bs-attempt-beat", onAttempt as EventListener);
    return () => {
      window.removeEventListener("bs-attempt-beat", onAttempt as EventListener);
    };
  }, [attemptBeat.isReady, attemptBeat, instanceId, selectedCharacterId]);
  return (
    <>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "70dvh",
          overflow: "hidden",
        }}
      >
        <Suspense fallback={<div>Loading renderer…</div>}>
          <GameRenderer
            // @ts-expect-error dynamic type cast is minimal; renderer uses props at runtime
            beats={songBeats}
            effectiveStartMs={effectiveStartMs}
          />
        </Suspense>
        <div
          id="hud-root"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {/* HUD overlay content (pointerEvents must be enabled within children containers) */}
          {children}
        </div>
      </div>
      {showDebug && <GameDebugPanel />}
    </>
  );
}
