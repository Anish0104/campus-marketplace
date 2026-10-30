"use client";

import { createTheme } from "@mui/material/styles";

// Shared theme for the whole app. Change colors and fonts here only.
export const theme = createTheme({
  palette: {
    primary: { main: "#cc0033" }, // Rutgers scarlet
    secondary: { main: "#5f6a72" },
    background: { default: "#fafafa" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
});
