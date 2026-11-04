import Box from "@mui/material/Box";
import ListingCard from "./ListingCard";
import type { ListingSummary } from "@/lib/types";

/** Responsive grid of listing cards: one column on phones, up to four on wide screens. */
export default function ListingGrid({ listings }: { listings: ListingSummary[] }) {
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        p: 0,
        m: 0,
        display: "grid",
        gap: 2,
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      }}
    >
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} />
        </li>
      ))}
    </Box>
  );
}
