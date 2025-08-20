"use client";

import { createTheme } from "@mui/material/styles";

// Create a clean Material-UI theme with minimal customization
// Following the user's preference for clean out-of-box MUI usage
export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7f5af0",
    },
    secondary: {
      main: "#72757e",
    },
    background: {
      default: "#16161a",
      paper: "#16161a",
    },
    text: {
      primary: "#fffffe",
      secondary: "#94a1b2",
    },
    divider: "#010101",
  },
  typography: {
    fontFamily:
      'var(--font-space-grotesk), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8, // MUI default
  // Minimal theme customization - only add when specific requirements identified
  components: {
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
        variant: "outlined",
      },
    },
  },
});

export default theme;
