"use client";

import { useSyncExternalStore } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useCurrentUser } from "./CurrentUserProvider";
import { DEV_LOGIN_ENABLED, DEV_USERS } from "@/lib/devUsers";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** TEMPORARY: switch between test accounts until sign-in lands. */
export default function DevUserSwitcher() {
  const { user, setUserId } = useCurrentUser();
  // The provider can read localStorage before the header's Suspense boundary
  // hydrates. Match our server output (null) until this consumer has hydrated,
  // even if the context already contains the persisted account.
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  if (!DEV_LOGIN_ENABLED || !hydrated || !user) return null;

  return (
    <TextField
      select
      label="Test account"
      value={user.id}
      onChange={(e) => setUserId(e.target.value)}
      sx={{ minWidth: 160 }}
    >
      {DEV_USERS.map((u) => (
        <MenuItem key={u.id} value={u.id}>
          {u.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
