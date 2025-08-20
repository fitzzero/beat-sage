"use client";

import {
  Collapse,
  Stack,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Box,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import StopIcon from "@mui/icons-material/Stop";
import { useCancelStream } from "../../hooks";

type Step = {
  index: number;
  total: number;
  title: string;
  status: "start" | "end";
};

type ThinkingPanelProps = {
  open: boolean;
  steps: string[];
  stepEvents: Step[];
  contextMessages?: number;
  deltaText: string;
  onToggle?: () => void;
};

export default function ThinkingPanel({
  open,
  steps,
  stepEvents,
  contextMessages,
  deltaText,
  onToggle,
}: ThinkingPanelProps) {
  const activeIndexes = new Set(
    stepEvents.filter((s) => s.status === "start").map((s) => s.index)
  );
  const completedIndexes = new Set(
    stepEvents.filter((s) => s.status === "end").map((s) => s.index)
  );
  // Hide entirely if closed and there is truly nothing to show
  if (
    !open &&
    steps.length === 0 &&
    !deltaText &&
    typeof contextMessages !== "number"
  ) {
    return null;
  }

  return (
    <Stack
      spacing={1}
      sx={{
        p: 1,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="caption" color="text.secondary">
          Thinking
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {typeof contextMessages === "number" && (
            <Chip size="small" label={`context: ${contextMessages}`} />
          )}
          <IconButton
            size="small"
            onClick={onToggle}
            aria-label="toggle-thinking"
          >
            {open ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>
      </Stack>
      <Collapse in={open} mountOnEnter unmountOnExit>
        {steps.length > 0 && (
          <Stack spacing={0.5}>
            {steps.map((title, i) => {
              const idx = i + 1;
              const done = completedIndexes.has(idx);
              const active = activeIndexes.has(idx) && !done;
              return (
                <Stack
                  key={idx}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <Chip
                    size="small"
                    color={done ? "success" : active ? "primary" : "default"}
                    label={`Step ${idx}`}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {title}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}
        <LinearProgress sx={{ my: 0.5 }} />
        {deltaText && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "pre-wrap" }}
          >
            {deltaText}
          </Typography>
        )}
        <ThinkingActions />
      </Collapse>
    </Stack>
  );
}

function ThinkingActions() {
  const cancel = useCancelStream();
  // The parent component owns the chatId context; simple approach: infer from latest event is complex.
  // For clarity, we accept a small inversion: rely on data-attribute on body if needed.
  // Simpler: expose cancel via window event. Here, we keep it as a prop-less demo and no-op if not wired.
  // Better: lift cancel to ChatHistory and pass a bound handler with chatId.
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
      <IconButton
        aria-label="Stop generation"
        size="small"
        color="error"
        onClick={() => {
          const el = document.querySelector(
            "[data-chat-id]"
          ) as HTMLElement | null;
          const chatId = el?.getAttribute("data-chat-id");
          if (chatId) {
            void (
              cancel.execute as unknown as (p: {
                chatId: string;
              }) => Promise<unknown>
            )({ chatId });
          }
        }}
      >
        <StopIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
