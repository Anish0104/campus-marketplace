"use client";

import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useCurrentUser } from "./CurrentUserProvider";
import { useFavorites } from "./FavoritesProvider";
import { isListingId } from "@/lib/favorites";
import { useHydrated } from "@/lib/useHydrated";
import { tokens } from "@/theme/tokens";

type Props = {
  listingId: string;
  title: string;
  /** Hidden on your own listings, which can't be saved. */
  sellerId?: string;
  /** Sold listings can't be newly saved, but a saved one can still be unsaved. */
  available?: boolean;
  /** "icon" is the round heart on a listing card; "button" is the labelled button on a listing page. */
  variant?: "icon" | "button";
};

/** Heart button that saves or unsaves a listing for the signed-in student. */
export default function SaveButton({ listingId, title, sellerId, available = true, variant = "icon" }: Props) {
  const hydrated = useHydrated();
  const { user } = useCurrentUser();
  const { ready, isSaved, isPending, setSaved } = useFavorites();

  if (!hydrated || !user || !ready || !isListingId(listingId) || sellerId === user.id) return null;
  const saved = isSaved(listingId);
  if (!saved && !available) return null;

  const label = saved ? `Remove ${title} from saved` : `Save ${title}`;
  const toggle = (event: React.MouseEvent) => {
    // On a card the button sits over the card's link; don't open the listing.
    event.preventDefault();
    event.stopPropagation();
    void setSaved(listingId, !saved);
  };
  const icon = saved ? <FavoriteIcon /> : <FavoriteBorderIcon />;

  if (variant === "button") {
    return (
      <Button
        variant="outlined"
        startIcon={icon}
        onClick={toggle}
        disabled={isPending(listingId)}
        aria-pressed={saved}
        aria-label={label}
        sx={{ color: saved ? tokens.scarlet : undefined, borderColor: saved ? tokens.scarlet : undefined }}
      >
        {saved ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <Tooltip title={saved ? "Saved" : "Save"}>
      <IconButton
        onClick={toggle}
        disabled={isPending(listingId)}
        aria-pressed={saved}
        aria-label={label}
        size="small"
        sx={{
          bgcolor: "rgba(255, 255, 255, 0.92)",
          color: saved ? tokens.scarlet : tokens.ink,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
          "&:hover": { bgcolor: tokens.paper },
          "&.Mui-disabled": { bgcolor: "rgba(255, 255, 255, 0.92)", color: saved ? tokens.scarlet : tokens.ink },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
