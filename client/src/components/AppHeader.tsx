"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import DevUserSwitcher from "./DevUserSwitcher";
import { tokens } from "@/theme/tokens";

const NAV = [
  { href: "/", label: "Browse", icon: <StorefrontOutlinedIcon /> },
  { href: "/messages", label: "Messages", icon: <ChatBubbleOutlineIcon /> },
];

/** Top navigation shown on every page (rendered in app/layout.tsx). */
export default function AppHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ bgcolor: tokens.paper, color: tokens.ink, borderBottom: `1px solid ${tokens.line}` }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 60, sm: 68 } }}>
          <Typography
            component={Link}
            href="/"
            sx={{
              fontFamily: '"Bricolage Grotesque Variable", system-ui, sans-serif',
              fontWeight: 750,
              fontSize: { xs: "1.05rem", sm: "1.25rem" },
              letterSpacing: "-0.02em",
              color: "inherit",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Campus Marketplace
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, ml: 2 }}>
            {NAV.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                color="inherit"
                aria-current={isActive(item.href) ? "page" : undefined}
                sx={{
                  color: isActive(item.href) ? tokens.ink : tokens.muted,
                  bgcolor: isActive(item.href) ? tokens.mist : "transparent",
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "flex", md: "none" } }}>
            {NAV.map((item) => (
              <Tooltip key={item.href} title={item.label}>
                <IconButton
                  component={Link}
                  href={item.href}
                  aria-label={item.label}
                  sx={{ color: isActive(item.href) ? tokens.scarlet : tokens.muted }}
                >
                  {item.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Stack>

          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <DevUserSwitcher />
          </Box>

          <Button
            component={Link}
            href="/listings/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          >
            Sell an item
          </Button>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
