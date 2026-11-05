"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useCurrentUser } from "./CurrentUserProvider";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Stack role="status" sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress aria-label="Checking sign-in" />
      </Stack>
    );
  }
  return children;
}
