"use client";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useCurrentUser } from "./CurrentUserProvider";
import { DEV_LOGIN_ENABLED, DEV_USERS } from "@/lib/devUsers";

/** TEMPORARY: switch between test accounts until sign-in lands. */
export default function DevUserSwitcher() {
  const { user, setUserId } = useCurrentUser();
  if (!DEV_LOGIN_ENABLED || !user) return null;

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
