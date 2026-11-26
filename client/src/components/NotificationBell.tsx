"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";

type Notification = {
  _id: string;
  text: string;
  link: string;
  read: boolean;
};

const endpoint = "/api/notifications";

export default function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [alerts, setAlerts] = useState<Notification[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const refreshRequest = useRef<AbortController | null>(null);
  const openRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    refreshRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    const { signal } = controller;
    try {
      const [items, unread] = await Promise.all([
        apiFetch<Notification[]>(endpoint, { signal }),
        apiFetch<{ count: number }>(`${endpoint}/unread-count`, { signal }),
      ]);
      if (signal.aborted) return;
      setAlerts(items);
      setCount(unread.count);
      setError("");
    } catch {
      if (!signal.aborted) setError("Couldn’t load notifications.");
    }
  }, []);

  useEffect(() => {
    const socket = getSocket(userId);
    const initialRefresh = window.setTimeout(refresh, 0);
    socket.on("notification:new", refresh);
    socket.on("connect", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      refreshRequest.current?.abort();
      openRequest.current?.abort();
      socket.off("notification:new", refresh);
      socket.off("connect", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, refresh]);

  async function openAlert(alert: Notification) {
    if (!/^\/(?!\/)[^\\\s]*$/.test(alert.link)) {
      setError("This notification has an invalid link.");
      return;
    }
    if (!alert.read) {
      const controller = new AbortController();
      openRequest.current = controller;
      setOpening(true);
      try {
        await apiFetch(`${endpoint}/${alert._id}/read`, { method: "PATCH", signal: controller.signal });
        if (controller.signal.aborted) return;
        void refresh();
      } catch {
        if (!controller.signal.aborted) setError("Couldn’t mark this notification as read. Try again.");
        return;
      } finally {
        if (!controller.signal.aborted) setOpening(false);
      }
    }
    setAnchor(null);
    router.push(alert.link);
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          id="notifications-button"
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          aria-haspopup="menu"
          aria-controls={anchor ? "notifications-menu" : undefined}
          aria-expanded={Boolean(anchor)}
          onClick={(event) => {
            setAnchor(event.currentTarget);
            void refresh();
          }}
        >
          <Badge badgeContent={count} max={99} color="primary">
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{
          list: { id: "notifications-menu", "aria-labelledby": "notifications-button" },
          paper: { sx: { width: 340, maxHeight: 420 } },
        }}
      >
        {error && <MenuItem onClick={() => void refresh()}>{error}</MenuItem>}
        {!error && !alerts?.length && (
          <MenuItem disabled>{alerts ? "No notifications yet" : "Loading notifications…"}</MenuItem>
        )}
        {alerts?.map((alert) => (
          <MenuItem key={alert._id} disabled={opening} onClick={() => void openAlert(alert)}>
            <Typography sx={{ whiteSpace: "normal", overflowWrap: "anywhere", fontWeight: alert.read ? 400 : 700 }}>
              {!alert.read && "Unread · "}{alert.text}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
