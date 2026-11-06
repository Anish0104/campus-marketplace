"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import LinkButton from "@/components/LinkButton";
import { startConversation } from "@/lib/messages";

type Props = {
  listingId: string;
  sellerId: string;
  /** Only active listings can start a new chat. */
  available: boolean;
};

/** Opens (or reopens) the chat with this listing's seller. */
export default function MessageSellerButton({ listingId, sellerId, available }: Props) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !available || user?.id === sellerId) return null;

  if (!user) {
    return (
      <LinkButton
        href={`/login?returnTo=${encodeURIComponent(`/listings/${listingId}`)}`}
        variant="contained"
        color="secondary"
        startIcon={<ChatBubbleOutlineIcon />}
        fullWidth
      >
        Sign in to message the seller
      </LinkButton>
    );
  }

  async function open() {
    setOpening(true);
    setError(null);
    try {
      const conversation = await startConversation(listingId);
      router.push(`/messages?c=${conversation._id}`);
    } catch (e) {
      setError((e as Error).message);
      setOpening(false);
    }
  }

  return (
    <Stack spacing={1}>
      <Button
        variant="contained"
        color="secondary"
        startIcon={<ChatBubbleOutlineIcon />}
        onClick={open}
        disabled={opening}
        fullWidth
      >
        {opening ? "Opening chat…" : "Message seller"}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
