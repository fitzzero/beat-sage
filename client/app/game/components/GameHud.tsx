"use client";

import React from "react";
import {
  Box,
  Chip,
  Stack,
  Typography,
  LinearProgress,
  Avatar,
  Paper,
  Button,
} from "@mui/material";
import { useRestartInstance } from "../../hooks/instance/useInstanceMethods";

type GameHudProps = {
  instanceId?: string;
  characterName?: string;
  songName?: string;
  score?: number;
  combo?: number;
  hp?: number; // 0-100
  mana?: number; // 0-100
};

export default function GameHud({
  instanceId: _instanceId,
  characterName,
  songName,
  score = 0,
  combo = 0,
  hp = 100,
  mana = 100,
}: GameHudProps) {
  const restartInstance = useRestartInstance();
  return (
    <Box
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          mt: "auto",
          p: 1,
          bgcolor: "background.paper",
          pointerEvents: "auto",
        }}
      >
        {/* Header: Song name + Dev restart */}
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {songName ? `Song: ${songName}` : "Song: —"}
          </Typography>
          <Box sx={{ ml: "auto" }} />
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              _instanceId && restartInstance.isReady
                ? void restartInstance.execute({ id: _instanceId })
                : undefined
            }
            disabled={!_instanceId || !restartInstance.isReady}
          >
            Restart
          </Button>
        </Stack>
        {/* Row 1: Health + Mana side-by-side */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Health
            </Typography>
            <LinearProgress
              variant="determinate"
              value={hp}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Mana
            </Typography>
            <LinearProgress
              variant="determinate"
              value={mana}
              color="secondary"
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        </Stack>

        {/* Row 2: Skill bar (placeholder) */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Chip size="small" label="Skill 1" />
          <Chip size="small" label="Skill 2" />
          <Chip size="small" label="Skill 3" />
        </Stack>

        {/* Row 3: Avatar / Name / Score & Combo */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <Avatar sx={{ width: 28, height: 28 }}>U</Avatar>
          <Typography variant="body2">
            {characterName || "Adventurer"}
          </Typography>
          <Box sx={{ ml: "auto" }}>
            <Chip
              size="small"
              color="primary"
              label={`Score ${score}`}
              sx={{ mr: 1 }}
            />
            <Chip size="small" color="secondary" label={`Combo ${combo}`} />
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
