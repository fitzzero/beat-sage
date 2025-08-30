"use client";

import React from "react";
import MainLayout from "../components/layout/MainLayout";
import { GameProvider } from "../game/GameContext";
import GameLanding from "../game/GameLanding";

export default function GamePage() {
  return (
    <MainLayout>
      <GameProvider>
        <GameLanding />
      </GameProvider>
    </MainLayout>
  );
}
