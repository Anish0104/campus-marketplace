"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import EmptyState from "@/components/EmptyState";
import { useFavorites } from "@/components/FavoritesProvider";
import LinkButton from "@/components/LinkButton";
import ListingGrid from "@/components/ListingGrid";
import LoadingGrid from "@/components/LoadingGrid";
import PageHeader from "@/components/PageHeader";
import { ApiError } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import { toListingSummary } from "@/lib/listings";
import type { SavedListing } from "@/lib/types";
import { tokens } from "@/theme/tokens";

type Result = { attempt: number; favorites?: SavedListing[]; error?: ApiError };

/** The Saved page: listings still for sale as cards, the rest in a "no longer available" list. */
export default function SavedView() {
  const { ready, isSaved, setSaved, isPending } = useFavorites();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFavorites(controller.signal)
      .then((favorites) => { if (!controller.signal.aborted) setResult({ attempt, favorites }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ attempt, error: error instanceof ApiError ? error : new ApiError("Couldn't load your saved listings. Please try again.", 0) });
      });
    return () => controller.abort();
  }, [attempt]);

  const header = <PageHeader title="Saved listings" description="Listings you saved, newest first. Sold or removed ones move to the bottom." />;
  const current = result?.attempt === attempt ? result : null;
  if (!current) return <>{header}<LoadingGrid count={4} /></>;
  if (current.error) {
    return (
      <>
        {header}
        <Alert severity="error" sx={{ mb: 2 }}>{current.error.message}</Alert>
        <Button variant="outlined" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
      </>
    );
  }

  // Unsaving with a heart takes the listing off this page straight away.
  const stillSaved = current.favorites!.filter((f) => !ready || isSaved(f.listingId));
  const available = stillSaved.filter((f) => f.availability === "available" && f.listing);
  const gone = stillSaved.filter((f) => f.availability !== "available" || !f.listing);

  if (stillSaved.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<FavoriteBorderIcon />}
          title="No saved listings yet"
          description="Tap the heart on any listing to keep it here and come back to it later."
          action={<LinkButton href="/" variant="contained">Browse listings</LinkButton>}
        />
      </>
    );
  }

  return (
    <>
      {header}
      {available.length > 0 ? (
        <ListingGrid listings={available.map((f) => toListingSummary(f.listing!))} />
      ) : (
        <Alert severity="info">None of your saved listings are for sale right now.</Alert>
      )}

      {gone.length > 0 && (
        <Box component="section" aria-labelledby="saved-unavailable" sx={{ mt: 5 }}>
          <Typography id="saved-unavailable" variant="h4" component="h2" sx={{ mb: 0.5 }}>
            No longer available ({gone.length})
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            These were sold or taken down after you saved them.
          </Typography>
          <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
            {gone.map((f) => {
              const title = f.title ?? "A listing that was deleted";
              const sold = f.availability === "sold";
              return (
                <Paper component="li" key={f.listingId} variant="outlined" sx={{ p: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", bgcolor: tokens.paper }}>
                  <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere", color: sold ? undefined : "text.secondary" }}>
                      {sold ? <MuiLink component={Link} href={`/listings/${f.listingId}`} color="inherit">{title}</MuiLink> : title}
                    </Typography>
                    <Chip size="small" variant="outlined" label={sold ? "Sold" : "No longer available"} sx={{ mt: 0.75 }} />
                  </Box>
                  <Button
                    variant="outlined"
                    onClick={() => void setSaved(f.listingId, false)}
                    disabled={isPending(f.listingId)}
                    aria-label={`Remove ${title} from saved`}
                  >
                    Remove
                  </Button>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}
    </>
  );
}
