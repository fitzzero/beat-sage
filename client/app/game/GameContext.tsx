"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type {
  InstanceSnapshot as TInstanceSnapshot,
  PartySnapshot as TPartySnapshot,
} from "@shared/types";
import { useListMyCharacters } from "../hooks/character/useCharacterMethods";
import {
  useCreateParty,
  useJoinParty,
  useLeaveParty,
  useSetReady,
  useSubscribePartyWithMembers,
} from "../hooks/party/usePartyMethods";
import {
  useCreateInstance,
  useStartInstance,
} from "../hooks/instance/useInstanceMethods";
import { useSubscription } from "../hooks/useSubscription";

type GameContextValue = {
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string | null) => void;
  characters: Array<{ id: string; name: string }>;

  partyId: string | null;
  party: TPartySnapshot | null;
  isHost: boolean;
  isReady: boolean;

  instanceId: string | null;
  instance: TInstanceSnapshot | null;

  selectedSongId: string | null;
  selectedLocationId: string | null;

  setReady: (ready: boolean) => Promise<void>;
  createParty: () => Promise<string | null>;
  joinParty: (partyId: string) => Promise<void>;
  leaveParty: () => Promise<void>;
  invitePlayers: () => Promise<boolean>;

  selectSong: (songId: string) => void;
  selectLocation: (locationId: string) => void;
  createInstance: () => Promise<string | null>;
  startInstance: () => Promise<void>;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({
  children,
  initialPartyId,
}: {
  children: React.ReactNode;
  initialPartyId?: string;
}) {
  const searchParams = useSearchParams();
  // router currently unused; add later for flows
  const invitedPartyId = searchParams.get("partyId");

  // Characters
  const listMine = useListMyCharacters();
  const [characters, setCharacters] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Selected character (persist in localStorage)
  const [selectedCharacterId, setSelectedCharacterIdState] = useState<
    string | null
  >(null);
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("bs:selectedCharacterId")
        : null;
    if (saved) {
      setSelectedCharacterIdState(saved);
    }
  }, []);
  const setSelectedCharacterId = useCallback((id: string | null) => {
    setSelectedCharacterIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        window.localStorage.setItem("bs:selectedCharacterId", id);
      } else {
        window.localStorage.removeItem("bs:selectedCharacterId");
      }
    }
  }, []);

  useEffect(() => {
    if (!listMine.isReady) {
      return;
    }
    void (async () => {
      const rows = (await listMine.execute({
        page: 1,
        pageSize: 25,
      })) as Array<{
        id: string;
        name: string;
      }> | null;
      setCharacters(rows || []);
      // Default select first if none selected
      if (!selectedCharacterId && rows && rows.length > 0) {
        setSelectedCharacterId(rows[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMine.isReady]);

  // Party state
  const [partyId, setPartyId] = useState<string | null>(initialPartyId ?? null);
  const [party, setParty] = useState<TPartySnapshot | null>(null);
  const createParty = useCreateParty();
  const joinPartyMethod = useJoinParty();
  const leavePartyMethod = useLeaveParty();
  const setReadyMethod = useSetReady();
  const subscribeWithMembers = useSubscribePartyWithMembers();

  // Instance state
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [instance, setInstance] = useState<TInstanceSnapshot | null>(null);
  const createInstanceMethod = useCreateInstance();
  const startInstanceMethod = useStartInstance();

  // Pending selections
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  // Subscribe to party updates; use update stream to set snapshot
  useSubscription("partyService", partyId, {
    autoSubscribe: !!partyId,
    onUpdate: (data) => {
      setParty(data as TPartySnapshot);
    },
  });

  // Register on server via subscribeWithMembers to receive updates and get initial snapshot
  useEffect(() => {
    if (!partyId) {
      return;
    }
    if (!subscribeWithMembers.isReady) {
      return;
    }
    void (async () => {
      const res = (await subscribeWithMembers.execute({
        partyId,
      })) as TPartySnapshot | null;
      if (res) {
        setParty(res);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, subscribeWithMembers.isReady]);

  // Subscribe to instance updates
  useSubscription("instanceService", instanceId, {
    autoSubscribe: !!instanceId,
    onUpdate: (data) => {
      setInstance(data as TInstanceSnapshot);
    },
  });

  // Auto-join invited party if in URL and we have a character selected
  useEffect(() => {
    if (!invitedPartyId || !selectedCharacterId) {
      return;
    }
    if (!joinPartyMethod.isReady) {
      return;
    }
    void (async () => {
      const res = await joinPartyMethod.execute({
        partyId: invitedPartyId,
        characterId: selectedCharacterId,
      });
      if (res) {
        setPartyId(invitedPartyId);
        // Clean URL: remove query param
        const url = new URL(window.location.href);
        url.searchParams.delete("partyId");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedPartyId, selectedCharacterId, joinPartyMethod.isReady]);

  // Auto-join when initialPartyId is provided via slug
  useEffect(() => {
    if (!initialPartyId || !selectedCharacterId) {
      return;
    }
    if (!joinPartyMethod.isReady) {
      return;
    }
    void (async () => {
      const res = await joinPartyMethod.execute({
        partyId: initialPartyId,
        characterId: selectedCharacterId,
      });
      if (res) {
        setPartyId(initialPartyId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPartyId, selectedCharacterId, joinPartyMethod.isReady]);

  // Actions
  const createPartyAction = useCallback(async (): Promise<string | null> => {
    if (!selectedCharacterId || !createParty.isReady) {
      return null;
    }
    const result = (await createParty.execute({
      hostCharacterId: selectedCharacterId,
    })) as { id: string } | null;
    if (result?.id) {
      setPartyId(result.id);
      return result.id;
    }
    return null;
  }, [createParty, selectedCharacterId]);

  const joinParty = useCallback(
    async (newPartyId: string) => {
      if (!selectedCharacterId || !joinPartyMethod.isReady) {
        return;
      }
      const result = await joinPartyMethod.execute({
        partyId: newPartyId,
        characterId: selectedCharacterId,
      });
      if (result) {
        setPartyId(newPartyId);
      }
    },
    [joinPartyMethod, selectedCharacterId]
  );

  const leaveParty = useCallback(async () => {
    if (!partyId || !selectedCharacterId || !leavePartyMethod.isReady) {
      return;
    }
    const result = await leavePartyMethod.execute({
      partyId,
      characterId: selectedCharacterId,
    });
    if (result) {
      setPartyId(null);
      setParty(null);
    }
  }, [partyId, selectedCharacterId, leavePartyMethod]);

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!partyId || !selectedCharacterId || !setReadyMethod.isReady) {
        return;
      }
      await setReadyMethod.execute({
        partyId,
        characterId: selectedCharacterId,
        isReady: ready,
      });
    },
    [partyId, selectedCharacterId, setReadyMethod]
  );

  const selectSong = useCallback(
    (songId: string) => setSelectedSongId(songId),
    []
  );
  const selectLocation = useCallback(
    (locationId: string) => setSelectedLocationId(locationId),
    []
  );

  const createInstance = useCallback(async (): Promise<string | null> => {
    if (!partyId || !selectedSongId || !selectedLocationId) {
      return null;
    }
    if (!createInstanceMethod.isReady) {
      return null;
    }
    const res = (await createInstanceMethod.execute({
      partyId,
      songId: selectedSongId,
      locationId: selectedLocationId,
    })) as { id: string; status: TInstanceSnapshot["status"] } | null;
    if (res?.id) {
      setInstanceId(res.id);
      return res.id;
    }
    return null;
  }, [partyId, selectedSongId, selectedLocationId, createInstanceMethod]);

  const startInstance = useCallback(async () => {
    if (!instanceId || !startInstanceMethod.isReady) {
      return;
    }
    await startInstanceMethod.execute({ id: instanceId });
  }, [instanceId, startInstanceMethod]);

  const invitePlayers = useCallback(async () => {
    if (!partyId) {
      return false;
    }
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/${encodeURIComponent(partyId)}`;
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, [partyId]);

  // Derived flags
  const isHost = useMemo(() => {
    if (!party || !selectedCharacterId) {
      return false;
    }
    return party.hostCharacterId === selectedCharacterId;
  }, [party, selectedCharacterId]);

  const isReady = useMemo(() => {
    if (!party || !selectedCharacterId) {
      return false;
    }
    const me = party.members.find(
      (m: { characterId: string; isReady: boolean }) =>
        m.characterId === selectedCharacterId
    );
    return !!me?.isReady;
  }, [party, selectedCharacterId]);

  const value: GameContextValue = {
    selectedCharacterId,
    setSelectedCharacterId,
    characters,
    partyId,
    party,
    isHost,
    isReady,
    instanceId,
    instance,
    selectedSongId,
    selectedLocationId,
    setReady,
    createParty: createPartyAction,
    joinParty,
    leaveParty,
    invitePlayers,
    selectSong,
    selectLocation,
    createInstance,
    startInstance,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within GameProvider");
  }
  return ctx;
}
