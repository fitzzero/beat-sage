"use client";

import React from "react";
import Typography, { type TypographyProps } from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

export type GradientTypographyProps = TypographyProps & {
  colors?: string[];
  animationSpeed?: number; // seconds
  showBorder?: boolean;
};

export default function GradientTypography({
  children,
  colors = ["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"],
  animationSpeed = 8,
  showBorder = false,
  sx,
  ...typographyProps
}: GradientTypographyProps) {
  const theme = useTheme();
  const gradient = `linear-gradient(to right, ${colors.join(", ")})`;
  const animation = `mui-gradient-move ${animationSpeed}s linear infinite`;

  return (
    <Typography
      component="span"
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.shape.borderRadius,
        // Keep default Typography spacing; allow caller to control padding via sx
        overflow: showBorder ? "hidden" : undefined,
        // Let consumers opt-in to pointer/hover via sx if desired
        ...sx,
      }}
      {...typographyProps}
    >
      {showBorder && (
        <>
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage: gradient,
              backgroundSize: "300% 100%",
              animation,
              borderRadius: "inherit",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 1, // creates a ~1px border reveal
              backgroundColor: theme.palette.background.default,
              borderRadius: "inherit",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Gradient-filled text */}
      <Box
        component="span"
        sx={{
          position: "relative",
          zIndex: 1,
          display: "inline-block",
          backgroundImage: gradient,
          backgroundSize: "300% 100%",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
          animation,
        }}
      >
        {children}
      </Box>

      {/* Keyframes for gradient motion */}
      <style>{`
@keyframes mui-gradient-move {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
      `}</style>
    </Typography>
  );
}
