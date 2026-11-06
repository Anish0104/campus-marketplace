"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Box, Button, ButtonBase, Chip, CircularProgress, Divider, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import PageHeader from "@/components/PageHeader";
import PriceTag from "@/components/PriceTag";
import ConditionChip from "@/components/ConditionChip";
import EmptyState from "@/components/EmptyState";
import MessageSellerButton from "@/components/messages/MessageSellerButton";
import { ApiError } from "@/lib/api";
import { getListing } from "@/lib/listings";
import type { Listing } from "@/lib/types";
import { tokens } from "@/theme/tokens";

type Result = { key: string; listing?: Listing; error?: ApiError };

export default function ListingDetailPage() {
  return <Suspense fallback={<CircularProgress aria-label="Loading listing" />}><ListingDetail /></Suspense>;
}

function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${user?.id}:${id}:${attempt}`;
  const userId = user?.id;
  const validId = /^[a-f\d]{24}$/i.test(id);

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    getListing(id, controller.signal)
      .then((listing) => { if (!controller.signal.aborted) setResult({ key, listing }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof ApiError ? error : new ApiError("Couldn't load this listing. Please try again.", 0) });
      });
    return () => controller.abort();
  }, [userId, id, key, validId]);

  const actions = <Button component={Link} href="/listings/new" variant="outlined">Sell an item</Button>;
  if (!validId) return <><PageHeader title="Invalid listing link" /><Alert severity="error">The listing ID must contain 24 hexadecimal characters. Check the link and try again.</Alert></>;
  const current = result?.key === key ? result : null;
  if (!current) return <><PageHeader title="Listing details" /><Stack role="status" sx={{ alignItems: "center", py: 8 }} spacing={2}><CircularProgress aria-label="Loading listing" /><Typography>Loading listing…</Typography></Stack></>;
  if (current.error?.status === 404) return <><PageHeader title="Listing not found" /><EmptyState title="This listing isn't available" description="It may have been removed, or the link may be incorrect." action={actions} /></>;
  if (current.error) return <><PageHeader title="Couldn't load listing" /><Alert severity="error" sx={{ mb: 2 }}>{current.error.message}{current.error.status === 401 ? " Sign in with your Rutgers email and password to continue." : " Check your connection and try again."}</Alert><Button variant="outlined" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></>;
  const listing = current.listing!;
  return (
    <>
      <PageHeader title={listing.title} description="Listed on Campus Marketplace" actions={actions} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.4fr) minmax(0, 1fr)" }, gap: 3, alignItems: "start" }}>
        <PhotoGallery key={listing._id} listing={listing} />
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          <Stack spacing={2.5}>
            <Box><PriceTag price={listing.price} size="large" /></Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <ConditionChip condition={listing.condition} />
              <Chip label={listing.status === "active" ? "Available" : listing.status === "sold" ? "Sold" : "Removed"} size="small" variant="outlined" />
            </Stack>
            {listing.status !== "active" && <Alert severity="info">This listing is {listing.status} and is no longer available.</Alert>}
            <MessageSellerButton listingId={listing._id} sellerId={listing.seller} available={listing.status === "active"} />
            <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 2, rowGap: 1.5, "& dd": { m: 0, overflowWrap: "anywhere" }, "& dt": { color: "text.secondary" } }}>
              <Typography component="dt">Category</Typography><Typography component="dd">{listing.category}</Typography>
              <Typography component="dt">Seller</Typography><Typography component="dd"><MuiLink component={Link} href={`/users/${listing.seller}`}>{listing.seller === user?.id ? "View your profile" : "View seller profile"}</MuiLink></Typography>
              <Typography component="dt">Listed</Typography><Typography component="dd"><time dateTime={listing.createdAt}>{new Date(listing.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></Typography>
            </Box>
            {!user && <Alert severity="info">Browsing as a viewer. <Link href={`/login?returnTo=${encodeURIComponent(`/listings/${id}`)}`}>Sign in</Link> to participate in the marketplace.</Alert>}
            <Divider />
            <Typography variant="h4" component="h2">Description</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{listing.description}</Typography>
          </Stack>
        </Paper>
      </Box>
    </>
  );
}

function PhotoGallery({ listing }: { listing: Listing }) {
  const [selected, setSelected] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  const src = listing.photos[selected];
  const usable = src && !broken.includes(src);
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ overflow: "hidden", bgcolor: tokens.paper }}>
        {usable ? <Box component="img" src={src} alt={`${listing.title}, photo ${selected + 1} of ${listing.photos.length}`} onError={() => setBroken((prev) => [...prev, src])} sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "contain", display: "block" }} /> :
          <Stack sx={{ aspectRatio: "4 / 3", alignItems: "center", justifyContent: "center", bgcolor: tokens.mist, color: "text.secondary", gap: 1 }}>
            <ImageOutlinedIcon sx={{ fontSize: 56 }} /><Typography>{src ? "Photo couldn't be loaded" : "No photos provided"}</Typography>
          </Stack>}
      </Paper>
      {listing.photos.length > 1 && <Box role="group" aria-label="Listing photos" sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 1 }}>
        {listing.photos.map((photo, index) => <ButtonBase key={`${photo}:${index}`} aria-label={`Show photo ${index + 1} of ${listing.title}`} aria-pressed={selected === index} onClick={() => setSelected(index)} sx={{ overflow: "hidden", borderRadius: 1, border: "2px solid", borderColor: selected === index ? tokens.scarlet : tokens.line, "&.Mui-focusVisible": { outline: `3px solid ${tokens.raritan}`, outlineOffset: 2 } }}>
          <Box component="img" src={photo} alt={`Thumbnail ${index + 1}`} sx={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
        </ButtonBase>)}
      </Box>}
    </Stack>
  );
}
