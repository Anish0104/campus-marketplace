"use client";

import { createTheme } from "@mui/material/styles";
import { tokens } from "./tokens";

const display = '"Bricolage Grotesque Variable", "Figtree Variable", system-ui, sans-serif';
const body = '"Figtree Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const theme = createTheme({
  palette: {
    primary: { main: tokens.scarlet, dark: tokens.scarletDark, contrastText: "#FFFFFF" },
    secondary: { main: tokens.raritan, contrastText: "#FFFFFF" },
    text: { primary: tokens.ink, secondary: tokens.muted },
    divider: tokens.line,
    background: { default: tokens.mist, paper: tokens.paper },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: body,
    h1: { fontFamily: display, fontWeight: 700, fontSize: "2.5rem", lineHeight: 1.1, letterSpacing: "-0.02em" },
    h2: { fontFamily: display, fontWeight: 700, fontSize: "2rem", lineHeight: 1.15, letterSpacing: "-0.015em" },
    h3: { fontFamily: display, fontWeight: 650, fontSize: "1.5rem", lineHeight: 1.2 },
    h4: { fontFamily: display, fontWeight: 650, fontSize: "1.25rem", lineHeight: 1.25 },
    h5: { fontFamily: display, fontWeight: 600, fontSize: "1.125rem" },
    h6: { fontFamily: display, fontWeight: 600, fontSize: "1rem" },
    body1: { fontSize: "1rem", lineHeight: 1.55 },
    body2: { fontSize: "0.9rem", lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, paddingInline: 18 } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderColor: tokens.line } },
    },
    MuiPaper: {
      styleOverrides: { outlined: { borderColor: tokens.line } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiLink: {
      defaultProps: { underline: "hover", color: "secondary" },
    },
  },
});
