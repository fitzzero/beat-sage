"use client";

import React from "react";
import { Box, Stack, Typography, Chip, Button } from "@mui/material";
import { useGame } from "../GameContext";
import {
  useStartInstance,
  useRestartInstance,
} from "../../hooks/instance/useInstanceMethods";

export default function GameDebugPanel() {
  const {
    instanceId,
    instance,
    selectedSongId,
    selectedLocationId,
    songBeats,
    effectiveStartMs,
  } = useGame();
  const startInstance = useStartInstance();
  const restartInstance = useRestartInstance();

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Box sx={{ mt: 1, p: 1, borderTop: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="subtitle2">Debug</Typography>
        <Chip size="small" label={`instance: ${instanceId ?? "—"}`} />
        <Chip
          size="small"
          label={`status: ${(instance as any)?.status ?? "—"}`}
        />
        <Chip
          size="small"
          label={`startedAt: ${
            (instance as any)?.startedAt
              ? new Date((instance as any).startedAt).toLocaleTimeString()
              : "—"
          }`}
        />
        <Chip
          size="small"
          label={`effectiveStartMs: ${effectiveStartMs ?? "—"}`}
        />
        <Chip size="small" label={`songId: ${selectedSongId ?? "—"}`} />
        <Chip size="small" label={`locationId: ${selectedLocationId ?? "—"}`} />
        <Chip size="small" label={`beats: ${songBeats?.length ?? 0}`} />
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            instanceId && startInstance.isReady
              ? void startInstance.execute({ id: instanceId })
              : undefined
          }
          disabled={!instanceId || !startInstance.isReady}
        >
          Start
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            instanceId && restartInstance.isReady
              ? void restartInstance.execute({ id: instanceId })
              : undefined
          }
          disabled={!instanceId || !restartInstance.isReady}
        >
          Restart
        </Button>
      </Stack>
    </Box>
  );
}
