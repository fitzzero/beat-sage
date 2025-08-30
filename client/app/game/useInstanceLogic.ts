"use client";

import { useCallback, useEffect, useState } from "react";
import type { InstanceSnapshot as TInstanceSnapshot } from "@shared/types";
import {
  useCreateInstance,
  useStartInstance,
  useUpdateInstanceSettings,
} from "../hooks/instance/useInstanceMethods";
import { useSubscription } from "../hooks/useSubscription";

export function useInstanceLogic(
  partyId: string | null,
  instanceIdFromParty: string | null
) {
  const [instanceId, setInstanceId] = useState<string | null>(
    instanceIdFromParty
  );
  const [instance, setInstance] = useState<TInstanceSnapshot | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  const createInstanceMethod = useCreateInstance();
  const startInstanceMethod = useStartInstance();
  const updateInstanceSettings = useUpdateInstanceSettings();

  // Update instanceId when party provides it
  useEffect(() => {
    if (instanceIdFromParty && instanceIdFromParty !== instanceId) {
      setInstanceId(instanceIdFromParty);
    }
  }, [instanceIdFromParty, instanceId]);

  // Subscribe to instance updates
  useSubscription("instanceService", instanceId, {
    autoSubscribe: !!instanceId,
    onUpdate: (data) => {
      const instanceData = data as TInstanceSnapshot;
      setInstance(instanceData);
      // Sync local state with instance data immediately
      if (instanceData) {
        setSelectedSongId(instanceData.songId);
        setSelectedLocationId(instanceData.locationId);
      }
    },
  });

  // Also sync when instanceId changes (for initial load)
  useEffect(() => {
    if (instance && instanceId) {
      setSelectedSongId(instance.songId);
      setSelectedLocationId(instance.locationId);
    }
  }, [instance, instanceId]);

  // Create instance when both song and location are selected
  useEffect(() => {
    if (
      !instanceId &&
      selectedSongId &&
      selectedLocationId &&
      partyId &&
      createInstanceMethod.isReady
    ) {
      void (async () => {
        const res = (await createInstanceMethod.execute({
          partyId,
          songId: selectedSongId,
          locationId: selectedLocationId,
        })) as { id: string; status: TInstanceSnapshot["status"] } | null;
        if (res?.id) {
          setInstanceId(res.id);
        }
      })();
    }
  }, [
    instanceId,
    selectedSongId,
    selectedLocationId,
    partyId,
    createInstanceMethod,
  ]);

  const selectSong = useCallback(
    async (songId: string) => {
      setSelectedSongId(songId);

      // Create instance if one doesn't exist and we have both song and location
      let currentInstanceId = instanceId;
      if (
        !currentInstanceId &&
        selectedLocationId &&
        partyId &&
        createInstanceMethod.isReady
      ) {
        // Inline instance creation to avoid circular dependency
        const res = (await createInstanceMethod.execute({
          partyId,
          songId,
          locationId: selectedLocationId,
        })) as { id: string; status: TInstanceSnapshot["status"] } | null;
        if (res?.id) {
          setInstanceId(res.id);
          currentInstanceId = res.id;
        }
      }

      // Persist to instance if one exists
      if (currentInstanceId) {
        await updateInstanceSettings.execute({ id: currentInstanceId, songId });
        // Optimistically update local instance state
        if (instance) {
          setInstance({ ...instance, songId });
        }
      }
    },
    [
      instanceId,
      updateInstanceSettings,
      instance,
      selectedLocationId,
      partyId,
      createInstanceMethod,
    ]
  );

  const selectLocation = useCallback(
    async (locationId: string) => {
      setSelectedLocationId(locationId);

      // Create instance if one doesn't exist and we have both song and location
      let currentInstanceId = instanceId;
      if (
        !currentInstanceId &&
        selectedSongId &&
        partyId &&
        createInstanceMethod.isReady
      ) {
        // Inline instance creation to avoid circular dependency
        const res = (await createInstanceMethod.execute({
          partyId,
          songId: selectedSongId,
          locationId,
        })) as { id: string; status: TInstanceSnapshot["status"] } | null;
        if (res?.id) {
          setInstanceId(res.id);
          currentInstanceId = res.id;
        }
      }

      // Persist to instance if one exists
      if (currentInstanceId) {
        await updateInstanceSettings.execute({
          id: currentInstanceId,
          locationId,
        });
        // Optimistically update local instance state
        if (instance) {
          setInstance({ ...instance, locationId });
        }
      }
    },
    [
      instanceId,
      updateInstanceSettings,
      instance,
      selectedSongId,
      partyId,
      createInstanceMethod,
    ]
  );

  const startInstance = useCallback(async () => {
    if (!instanceId || !startInstanceMethod.isReady) {
      return;
    }
    await startInstanceMethod.execute({ id: instanceId });
  }, [instanceId, startInstanceMethod]);

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

  return {
    instanceId,
    instance,
    selectedSongId,
    selectedLocationId,
    selectSong,
    selectLocation,
    startInstance,
    createInstance,
  };
}
