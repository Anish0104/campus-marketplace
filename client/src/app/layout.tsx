import { Suspense } from "react";
import type { Metadata } from "next";
import Container from "@mui/material/Container";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import Providers from "@/components/Providers";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Campus Marketplace",
  description: "Buy, sell and trade with other Rutgers students",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; ignore that mismatch. */}
      <body suppressHydrationWarning>
        <Providers>
          <Suspense fallback={null}>
            <AppHeader />
          </Suspense>
          <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
            {children}
          </Container>
        </Providers>
      </body>
    </html>
  );
}
