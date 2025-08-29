"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "../components/layout/MainLayout";
import { GameProvider } from "../game/GameContext";
import GameLanding from "../game/GameLanding";

export default function PartyPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = Array.isArray(params?.partyId)
    ? params?.partyId[0]
    : (params?.partyId as string | undefined);

  // If no partyId somehow, push to root
  if (!partyId) {
    router.push("/");
    return null;
  }

  return (
    <MainLayout>
      <GameProvider initialPartyId={partyId}>
        <GameLanding />
      </GameProvider>
    </MainLayout>
  );
}
