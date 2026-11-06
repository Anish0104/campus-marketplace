"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useCurrentUser } from "./CurrentUserProvider";

export default function AuthGate({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`${admin ? "/admin/login" : "/login"}?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [loading, user, router, admin]);

  if (loading || !user) {
    return (
      <Stack role="status" sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress aria-label="Checking sign-in" />
      </Stack>
    );
  }
  if (admin && user.role !== "admin") return <Alert severity="error">Administrator access is required. Sign out before using an administrator account.</Alert>;
  return children;
}
