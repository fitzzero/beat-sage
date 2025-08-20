"use client";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export function useIsMobile(): boolean {
  const theme = useTheme();
  // Align with MUI default breakpoint for small screens
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  return isMobile;
}
