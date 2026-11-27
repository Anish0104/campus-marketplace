"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { theme } from "@/theme/theme";
import { CurrentUserProvider } from "./CurrentUserProvider";
import { FavoritesProvider } from "./FavoritesProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <CurrentUserProvider>
          <FavoritesProvider>{children}</FavoritesProvider>
        </CurrentUserProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
