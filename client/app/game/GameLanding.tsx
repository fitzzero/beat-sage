"use client";

import React, { useEffect, useState } from "react";
import { Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { useGame } from "./GameContext";
import SongSelectDialog from "./components/SongSelectDialog";
import LocationSelectDialog from "./components/LocationSelectDialog";
import { useListSongs, useListLocations } from "../hooks";

export default function GameLanding() {
  const {
    selectedCharacterId,
    characters,
    party,
    isHost,
    isReady,
    setReady,
    invitePlayers,
    selectedSongId,
    selectedLocationId,
    selectSong,
    selectLocation,
    createParty,
    partyId,
    createInstance,
    leaveParty,
  } = useGame();

  const [songDialogOpen, setSongDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const listSongs = useListSongs();
  const listLocations = useListLocations();
  const [songLabel, setSongLabel] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  // When a partyId is available and URL is not /[partyId], navigate to slug
  useEffect(() => {
    if (!partyId) {
      return;
    }
    if (pathname !== `/${partyId}`) {
      router.push(`/${partyId}`);
    }
  }, [partyId, pathname, router]);

  // Resolve song name for selectedSongId
  useEffect(() => {
    const resolve = async () => {
      if (!selectedSongId) {
        setSongLabel(null);
        return;
      }
      if (!listSongs.isReady) {
        return;
      }
      const res = (await listSongs.execute({
        page: 1,
        pageSize: 100,
      })) as Array<{ id: string; name: string }> | null;
      if (res && Array.isArray(res)) {
        const found = res.find((s) => s.id === selectedSongId);
        setSongLabel(found?.name ?? selectedSongId);
      }
    };
    void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSongId, listSongs.isReady]);

  // Resolve location name for selectedLocationId
  useEffect(() => {
    const resolve = async () => {
      if (!selectedLocationId) {
        setLocationLabel(null);
        return;
      }
      if (!listLocations.isReady) {
        return;
      }
      const res = (await listLocations.execute({
        page: 1,
        pageSize: 100,
      })) as Array<{ id: string; name: string; difficulty: number }> | null;
      if (res && Array.isArray(res)) {
        const found = res.find((l) => l.id === selectedLocationId);
        setLocationLabel(found?.name ?? selectedLocationId);
      }
    };
    void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, listLocations.isReady]);

  return (
    <Stack spacing={3} sx={{ py: 3 }}>
      {/* Party actions row */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant={isReady ? "contained" : "outlined"}
          size="small"
          onClick={() => void setReady(!isReady)}
          disabled={!party}
        >
          {isReady ? "Ready" : "Not Ready"}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            void invitePlayers();
          }}
          disabled={!party}
        >
          Invite Players
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => void leaveParty()}
          disabled={!party}
        >
          Leave Party
        </Button>
        {!party && (
          <Button
            variant="contained"
            size="small"
            onClick={() => void createParty()}
            disabled={!selectedCharacterId}
          >
            Create Party
          </Button>
        )}
      </Stack>

      <Divider />

      {/* Instance info row */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Stack flex={1} spacing={1}>
          <Typography variant="h6">Song</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={songLabel ?? "None selected"} />
            {isHost && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSongDialogOpen(true)}
              >
                Select song
              </Button>
            )}
          </Stack>

          <Typography variant="h6" sx={{ mt: 2 }}>
            Location
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={locationLabel ?? "None selected"} />
            {isHost && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setLocationDialogOpen(true)}
              >
                Select location
              </Button>
            )}
          </Stack>

          {isHost && (
            <Button
              sx={{ mt: 2 }}
              variant="contained"
              size="small"
              onClick={() => void createInstance()}
              disabled={!selectedSongId || !selectedLocationId || !partyId}
            >
              Create Instance
            </Button>
          )}
        </Stack>

        {/* Right column: location image placeholder */}
        <Box
          sx={{
            flex: 1,
            minHeight: 200,
            bgcolor: "action.hover",
            borderRadius: 1,
          }}
        />
      </Stack>

      <Divider />

      {/* Party info row */}
      <Stack spacing={1}>
        <Typography variant="h6">Party</Typography>
        <Stack direction="row" spacing={1} overflow="auto">
          {/* Primary user's character */}
          <Box
            sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
          >
            <Typography variant="body2">You</Typography>
            <Typography variant="subtitle2">
              {characters.find((c) => c.id === selectedCharacterId)?.name ||
                "Unselected"}
            </Typography>
          </Box>
          {/* Other members */}
          {(party?.members || [])
            .filter((m) => m.characterId !== selectedCharacterId)
            .map((m) => (
              <Box
                key={m.characterId}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">Member</Typography>
                <Typography variant="subtitle2">{m.characterId}</Typography>
                <Chip
                  size="small"
                  label={m.isReady ? "Ready" : "Not Ready"}
                  sx={{ mt: 1 }}
                />
              </Box>
            ))}
        </Stack>
      </Stack>

      {/* Dialogs */}
      <SongSelectDialog
        open={songDialogOpen}
        onClose={() => setSongDialogOpen(false)}
        onSelect={(songId) => {
          selectSong(songId);
          setSongDialogOpen(false);
        }}
      />
      <LocationSelectDialog
        open={locationDialogOpen}
        onClose={() => setLocationDialogOpen(false)}
        onSelect={(locationId) => {
          selectLocation(locationId);
          setLocationDialogOpen(false);
        }}
      />
    </Stack>
  );
}
