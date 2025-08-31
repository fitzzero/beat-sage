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
} from "@mui/material";
import { Icons } from "@client/app/lib/icons";
import { useGame } from "../GameContext";
import Image from "next/image";

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
  const { selectedCharacterId, instance } = useGame();
  const myMana = (instance?.membersMana || []).find(
    (m) => m.characterId === selectedCharacterId
  );
  const myHealth = (instance?.membersHealth || []).find(
    (h) => h.characterId === selectedCharacterId
  );
  const manaPercent = myMana
    ? Math.max(
        0,
        Math.min(100, (myMana.current / Math.max(1, myMana.maximum)) * 100)
      )
    : mana;
  const hpPercent = myHealth
    ? Math.max(
        0,
        Math.min(100, (myHealth.current / Math.max(1, myHealth.maximum)) * 100)
      )
    : hp;
  const manaRate = myMana?.rate ?? 0;
  const chevrons = (rate: number, maxRate = 5) =>
    Array.from({ length: Math.max(0, Math.min(maxRate, rate)) }).map((_, i) => (
      // eslint-disable-next-line react/no-array-index-key
      <Image
        key={i}
        src={Icons.CHEVRON_RIGHT}
        alt=">"
        width={10}
        height={10}
        style={{ opacity: 0.8 }}
      />
    ));
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
        </Stack>
        {/* Row 1: Health + Mana side-by-side (labels removed; values inside bars) */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Box sx={{ position: "relative" }}>
              <LinearProgress
                variant="determinate"
                value={hpPercent}
                sx={{
                  height: 18,
                  borderRadius: 1,
                  backgroundColor: "action.disabledBackground",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "error.light",
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                }}
              >
                {myHealth
                  ? `${myHealth.current}/${myHealth.maximum}`
                  : `${Math.round(hpPercent)}%`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ position: "relative" }}>
              <LinearProgress
                variant="determinate"
                value={manaPercent}
                sx={{
                  height: 18,
                  borderRadius: 1,
                  backgroundColor: "action.disabledBackground",
                  "& .MuiLinearProgress-bar": { backgroundColor: "info.light" },
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.5,
                }}
              >
                {chevrons(manaRate)}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                }}
              >
                {myMana
                  ? `${myMana.current}/${myMana.maximum}`
                  : `${Math.round(manaPercent)}%`}
              </Typography>
            </Box>
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
