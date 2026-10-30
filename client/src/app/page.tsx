import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import ApiStatus from "@/components/ApiStatus";

export default function Home() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
          Campus Marketplace
        </Typography>
        <Typography sx={{ color: "text.secondary" }}>
          Buy, sell and trade with other Rutgers students.
        </Typography>
        <ApiStatus />
      </Stack>
    </Container>
  );
}
