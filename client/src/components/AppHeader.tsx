"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
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
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { useCurrentUser } from "./CurrentUserProvider";
import { useHydrated } from "@/lib/useHydrated";
import { useUnreadCount } from "@/lib/useUnreadCount";
import { tokens } from "@/theme/tokens";

const NAV = [
  { href: "/", label: "Browse", icon: <StorefrontOutlinedIcon /> },
  { href: "/messages", label: "Messages", icon: <ChatBubbleOutlineIcon /> },
  { href: "/saved", label: "Saved", icon: <FavoriteBorderIcon /> },
];
/** Links that only make sense once signed in. */
const SIGNED_IN_ONLY = ["/messages", "/saved"];

/** Top navigation shown on every page (rendered in app/layout.tsx). */
export default function AppHeader() {
  const pathname = usePathname();
  const { user: currentUser, loading: userLoading, logout } = useCurrentUser();
  // The server renders this header before anyone is signed in. Until React has
  // attached to that HTML, render the same signed-out shell; then show the real state.
  const hydrated = useHydrated();
  const user = hydrated ? currentUser : null;
  const loading = !hydrated || userLoading;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const unread = useUnreadCount(user?.id);
  const navLabel = (item: (typeof NAV)[number]) =>
    item.href === "/messages" && unread > 0 ? `${item.label}, ${unread} unread` : item.label;
  const withBadge = (item: (typeof NAV)[number], node: React.ReactNode) =>
    item.href === "/messages" ? (
      <Badge badgeContent={unread > 0 ? unread : null} max={99} color="primary">
        {node}
      </Badge>
    ) : (
      node
    );

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ bgcolor: tokens.paper, color: tokens.ink, borderBottom: `1px solid ${tokens.line}` }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ flexWrap: "wrap", py: 1, gap: { xs: 0.5, sm: 2 }, minHeight: { xs: 60, sm: 68 } }}>
          <Typography
            component={Link}
            href="/"
            sx={{
              fontFamily: '"Bricolage Grotesque Variable", system-ui, sans-serif',
              fontWeight: 750,
              fontSize: { xs: "0.95rem", sm: "1.25rem" },
              letterSpacing: "-0.02em",
              color: "inherit",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Campus Marketplace
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, ml: 2 }}>
            {NAV.filter((item) => !SIGNED_IN_ONLY.includes(item.href) || user).map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                color="inherit"
                aria-current={isActive(item.href) ? "page" : undefined}
                aria-label={navLabel(item)}
                sx={{
                  color: isActive(item.href) ? tokens.ink : tokens.muted,
                  bgcolor: isActive(item.href) ? tokens.mist : "transparent",
                  "& .MuiBadge-badge": { right: -10, top: 2 },
                }}
              >
                {withBadge(item, item.label)}
              </Button>
            ))}
          </Stack>

          <Button component={Link} href="/rules" color="inherit">Rules</Button>
          {user?.role === "admin" && <Button component={Link} href="/admin" color="inherit">Admin</Button>}
          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "flex", md: "none" } }}>
            {NAV.filter((item) => !SIGNED_IN_ONLY.includes(item.href) || user).map((item) => (
              <Tooltip key={item.href} title={navLabel(item)}>
                <IconButton
                  component={Link}
                  href={item.href}
                  aria-label={navLabel(item)}
                  sx={{ color: isActive(item.href) ? tokens.scarlet : tokens.muted }}
                >
                  {withBadge(item, item.icon)}
                </IconButton>
              </Tooltip>
            ))}
          </Stack>

          {!loading && user ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" }, color: tokens.muted }}>
                {user.name}
              </Typography>
              <Button color="inherit" onClick={() => void logout()}>Sign out</Button>
            </Stack>
          ) : !loading ? (
            <Button component={Link} href="/login" color="inherit">Sign in</Button>
          ) : null}

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
