"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
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
import { useInstanceLogic } from "./useInstanceLogic";
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

  selectSong: (songId: string) => Promise<void>;
  selectLocation: (locationId: string) => Promise<void>;
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

  // Validate selected character exists after fetching characters
  useEffect(() => {
    if (characters.length > 0 && selectedCharacterId) {
      const characterExists = characters.some(
        (c) => c.id === selectedCharacterId
      );
      if (!characterExists) {
        // Clear invalid character selection
        setSelectedCharacterIdState(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("bs:selectedCharacterId");
        }
      }
    }
  }, [characters, selectedCharacterId]);
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

  const didFetchCharactersRef = useRef(false);
  useEffect(() => {
    if (!listMine.isReady || didFetchCharactersRef.current) {
      return;
    }
    didFetchCharactersRef.current = true;
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
  const subscribedPartyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!partyId || !subscribeWithMembers.isReady) {
      return;
    }
    if (subscribedPartyRef.current === partyId) {
      return;
    }
    subscribedPartyRef.current = partyId;
    void (async () => {
      const res = (await subscribeWithMembers.execute({
        partyId,
      })) as TPartySnapshot | null;
      if (res) {
        setParty(res);
      }
    })();
  }, [
    partyId,
    subscribeWithMembers.isReady,
    subscribeWithMembers,
    subscribeWithMembers.execute,
  ]);

  // Use the instance logic hook
  const {
    instanceId,
    instance,
    selectedSongId,
    selectedLocationId,
    selectSong,
    selectLocation,
    startInstance,
    createInstance,
  } = useInstanceLogic(partyId, party?.instanceId ?? null);

  // Subscribe to party updates; use update stream to set snapshot
  useSubscription("partyService", partyId, {
    autoSubscribe: !!partyId,
    onUpdate: (data) => {
      const partyData = data as TPartySnapshot;
      setParty(partyData);
    },
  });

  // Auto-join invited party if in URL and we have a character selected
  const didJoinByInviteRef = useRef(false);
  useEffect(() => {
    if (!invitedPartyId || !selectedCharacterId) {
      return;
    }
    if (!joinPartyMethod.isReady) {
      return;
    }
    if (didJoinByInviteRef.current) {
      return;
    }
    void (async () => {
      const res = await joinPartyMethod.execute({
        partyId: invitedPartyId,
        characterId: selectedCharacterId,
      });
      if (res) {
        setPartyId(invitedPartyId);
        didJoinByInviteRef.current = true;
        // Clean URL: remove query param
        const url = new URL(window.location.href);
        url.searchParams.delete("partyId");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedPartyId, selectedCharacterId, joinPartyMethod.isReady]);

  // Auto-join when initialPartyId is provided via slug
  const didJoinByInitialRef = useRef(false);
  useEffect(() => {
    if (!initialPartyId || !selectedCharacterId) {
      return;
    }
    if (!joinPartyMethod.isReady) {
      return;
    }
    if (didJoinByInitialRef.current) {
      return;
    }
    void (async () => {
      const res = await joinPartyMethod.execute({
        partyId: initialPartyId,
        characterId: selectedCharacterId,
      });
      if (res) {
        setPartyId(initialPartyId);
        didJoinByInitialRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPartyId, selectedCharacterId, joinPartyMethod.isReady]);

  // Actions
  const createPartyAction = useCallback(async (): Promise<string | null> => {
    if (!selectedCharacterId || !createParty.isReady) {
      return null;
    }

    // Double-check that the selected character actually exists
    const characterExists = characters.some(
      (c) => c.id === selectedCharacterId
    );
    if (!characterExists) {
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
  }, [createParty, selectedCharacterId, characters]);

  const joinParty = useCallback(
    async (newPartyId: string) => {
      if (!selectedCharacterId || !joinPartyMethod.isReady) {
        return;
      }

      // Double-check that the selected character actually exists
      const characterExists = characters.some(
        (c) => c.id === selectedCharacterId
      );
      if (!characterExists) {
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
    [joinPartyMethod, selectedCharacterId, characters]
  );

  const leaveParty = useCallback(async () => {
    if (!partyId || !selectedCharacterId || !leavePartyMethod.isReady) {
      return;
    }

    // Double-check that the selected character actually exists
    const characterExists = characters.some(
      (c) => c.id === selectedCharacterId
    );
    if (!characterExists) {
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
  }, [partyId, selectedCharacterId, leavePartyMethod, characters]);

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!partyId || !selectedCharacterId || !setReadyMethod.isReady) {
        return;
      }

      // Double-check that the selected character actually exists
      const characterExists = characters.some(
        (c) => c.id === selectedCharacterId
      );
      if (!characterExists) {
        return;
      }

      await setReadyMethod.execute({
        partyId,
        characterId: selectedCharacterId,
        isReady: ready,
      });
    },
    [partyId, selectedCharacterId, setReadyMethod, characters]
  );

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
