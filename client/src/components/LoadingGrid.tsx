import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

/** Placeholder grid shown while listings load. */
export default function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <Box
      aria-busy="true"
      aria-label="Loading listings"
      sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <Skeleton variant="rectangular" sx={{ aspectRatio: "4 / 3", height: "auto" }} />
          <Stack spacing={1} sx={{ p: 1.75 }}>
            <Skeleton width="90%" />
            <Skeleton width="60%" />
            <Skeleton width="40%" />
          </Stack>
        </Card>
      ))}
    </Box>
  );
}
