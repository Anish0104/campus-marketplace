"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Avatar, Box, Button, Paper, Stack, Typography } from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import EmptyState from "@/components/EmptyState";
import ListingGrid from "@/components/ListingGrid";
import LoadingGrid from "@/components/LoadingGrid";
import PageHeader from "@/components/PageHeader";
import { ApiError } from "@/lib/api";
import { initials } from "@/lib/format";
import { toListingSummary } from "@/lib/listings";
import type { PublicProfile } from "@/lib/types";
import { formatMemberSince, getProfile } from "@/lib/users";
import { tokens } from "@/theme/tokens";

type Result = { key: string; profile?: PublicProfile; error?: ApiError };

// Profile page (Santanu): name, NetID, member since and the user's active listings.
export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <Profile />
    </Suspense>
  );
}

function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;
  const key = `${userId}:${id}:${attempt}`;
  const validId = /^[a-f\d]{24}$/i.test(id);

  useEffect(() => {
    if (!userId || !validId) return;
    const controller = new AbortController();
    getProfile(userId, id, controller.signal)
      .then((profile) => { if (!controller.signal.aborted) setResult({ key, profile }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, error: error instanceof ApiError ? error : new ApiError("Couldn't load this profile. Please try again.", 0) });
      });
    return () => controller.abort();
  }, [userId, id, key, validId]);

  const browse = <Button component={Link} href="/" variant="outlined">Browse listings</Button>;
  if (!user) {
    return <><PageHeader title="Profile" /><EmptyState title="Sign in to view profiles" description="Select a test account or sign in, then open this profile again." /></>;
  }
  if (!validId) {
    return <><PageHeader title="Invalid profile link" /><Alert severity="error">The profile ID must contain 24 hexadecimal characters. Check the link and try again.</Alert></>;
  }
  const current = result?.key === key ? result : null;
  if (!current) {
    return <><PageHeader title="Profile" /><LoadingGrid count={4} /></>;
  }
  if (current.error?.status === 404) {
    return <><PageHeader title="Profile not found" /><EmptyState icon={<PersonOutlineIcon />} title="This profile isn't available" description="The student may not exist, or the link may be incorrect." action={browse} /></>;
  }
  if (current.error) {
    return (
      <>
        <PageHeader title="Couldn't load profile" />
        <Alert severity="error" sx={{ mb: 2 }}>
          {current.error.message}{current.error.status === 401 ? " Select a test account or sign in to continue." : " Check your connection and try again."}
        </Alert>
        <Button variant="outlined" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
      </>
    );
  }

  const profile = current.profile!;
  const isMe = profile.id === user.id;
  const count = profile.listings.length;
  return (
    <>
      <PageHeader title={isMe ? "Your profile" : "Student profile"} actions={isMe ? <Button component={Link} href="/listings/new" variant="contained">Sell an item</Button> : undefined} />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { xs: "flex-start", sm: "center" } }}>
          <Avatar aria-hidden sx={{ width: 72, height: 72, fontSize: "1.6rem", fontWeight: 650, bgcolor: tokens.scarlet }}>
            {initials(profile.name) || "?"}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" component="h2" sx={{ overflowWrap: "anywhere" }}>{profile.name}</Typography>
            <Box component="dl" sx={{ m: 0, mt: 1, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 2, rowGap: 0.5, "& dd": { m: 0 }, "& dt": { color: "text.secondary" } }}>
              <Typography component="dt">NetID</Typography>
              <Typography component="dd" sx={{ fontFamily: "monospace" }}>{profile.netId ?? "Not provided"}</Typography>
              <Typography component="dt">Member since</Typography>
              <Typography component="dd"><time dateTime={profile.memberSince}>{formatMemberSince(profile.memberSince)}</time></Typography>
            </Box>
          </Box>
        </Stack>
      </Paper>

      <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
        Active listings{count > 0 ? ` (${count})` : ""}
      </Typography>
      {count === 0 ? (
        <EmptyState
          title={isMe ? "You have no active listings" : `${profile.name} has no active listings`}
          description={isMe ? "Post something you no longer need and it will show up here." : "Check back later, or browse what other students are selling."}
          action={isMe ? <Button component={Link} href="/listings/new" variant="contained">Sell an item</Button> : browse}
        />
      ) : (
        <ListingGrid listings={profile.listings.map(toListingSummary)} />
      )}
    </>
  );
}
