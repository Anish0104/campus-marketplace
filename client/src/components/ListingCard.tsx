"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ConditionChip from "./ConditionChip";
import PriceTag from "./PriceTag";
import RelativeTime from "./RelativeTime";
import type { ListingSummary } from "@/lib/types";
import { tokens } from "@/theme/tokens";

/** One listing in a grid. Links to /listings/<id>. */
export default function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Card
      sx={{
        height: "100%",
        transition: "border-color 120ms",
        "&:hover": { borderColor: tokens.muted },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/listings/${listing.id}`}
        sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        {/* Fixed 4:3 frame: tall or wide photos are cropped so every card is the same size. */}
        <Box sx={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden", bgcolor: tokens.mist }}>
          {listing.imageUrl ? (
            <Box
              component="img"
              src={listing.imageUrl}
              alt=""
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", color: tokens.line }}>
              <ImageOutlinedIcon sx={{ fontSize: 48 }} />
            </Stack>
          )}
          <Box sx={{ position: "absolute", left: 12, bottom: 12 }}>
            <PriceTag price={listing.price} />
          </Box>
        </Box>

        <Stack spacing={1} sx={{ p: 1.75, flexGrow: 1 }}>
          <Typography
            component="h3"
            sx={{
              fontWeight: 600,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {listing.title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <ConditionChip condition={listing.condition} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {listing.category}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: "auto !important" }}>
            {listing.sellerName ? `${listing.sellerName}, ` : ""}
            <RelativeTime iso={listing.createdAt} />
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
