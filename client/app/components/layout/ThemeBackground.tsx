"use client";

import React from "react";
import { useTheme } from "@mui/material/styles";

export default function ThemeBackground() {
  const theme = useTheme();
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        backgroundColor: theme.palette.background.default,
        backgroundImage: `linear-gradient(0deg, transparent 0%, transparent 60%, ${theme.palette.action.hover} 100%)`,
      }}
    />
  );
}
