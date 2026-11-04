import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinkButton from "@/components/LinkButton";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import ConditionChip from "@/components/ConditionChip";
import EmptyState from "@/components/EmptyState";
import ListingCard from "@/components/ListingCard";
import ListingGrid from "@/components/ListingGrid";
import LoadingGrid from "@/components/LoadingGrid";
import PageHeader from "@/components/PageHeader";
import PriceTag from "@/components/PriceTag";
import { MOCK_LISTINGS } from "@/lib/mockListings";
import { tokens } from "@/theme/tokens";

export const metadata = { title: "UI components · Campus Marketplace" };

function Section({ name, file, children }: { name: string; file: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ py: 4 }}>
      <Typography variant="h3" component="h2">
        {name}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2.5, fontFamily: "ui-monospace, monospace" }}>
        {file}
      </Typography>
      {children}
    </Box>
  );
}

const SWATCHES = Object.entries(tokens);

/** Living reference of the shared components. Check here before building your own. */
export default function UiGallery() {
  return (
    <>
      <PageHeader
        title="UI components"
        description="Shared building blocks for every page. Import them from @/components instead of styling your own."
      />

      <Section name="Colors" file="src/theme/tokens.ts">
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {SWATCHES.map(([name, hex]) => (
            <Stack key={name} spacing={0.75}>
              <Box sx={{ height: 56, borderRadius: 1.5, bgcolor: hex, border: `1px solid ${tokens.line}` }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{name}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: "0 !important" }}>{hex}</Typography>
            </Stack>
          ))}
        </Box>
      </Section>
      <Divider />

      <Section name="Type" file="h1–h6 use Bricolage Grotesque, body text uses Figtree">
        <Stack spacing={1}>
          <Typography variant="h1">Sell your old textbooks</Typography>
          <Typography variant="h2">Heading 2</Typography>
          <Typography variant="h3">Heading 3</Typography>
          <Typography>Body text for descriptions and messages. Keep lines short and plain.</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Secondary text for timestamps and hints.</Typography>
        </Stack>
      </Section>
      <Divider />

      <Section name="Buttons" file="@mui/material/Button (styled by the theme)">
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
          <Button variant="contained">Post listing</Button>
          <Button variant="outlined">Save</Button>
          <Button color="inherit">Cancel</Button>
          <Button variant="contained" color="secondary">Message seller</Button>
          <Button variant="contained" disabled>Posting…</Button>
        </Stack>
      </Section>
      <Divider />

      <Section name="PriceTag" file="src/components/PriceTag.tsx">
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 2 }}>
          <PriceTag price={45} />
          <PriceTag price={18.5} />
          <PriceTag price={0} />
          <PriceTag price={120} size="large" />
        </Stack>
      </Section>
      <Divider />

      <Section name="ConditionChip" file="src/components/ConditionChip.tsx">
        <Stack direction="row" spacing={1}>
          <ConditionChip condition="new" />
          <ConditionChip condition="like_new" />
          <ConditionChip condition="good" />
          <ConditionChip condition="fair" />
        </Stack>
      </Section>
      <Divider />

      <Section name="ListingCard and ListingGrid" file="src/components/ListingCard.tsx, ListingGrid.tsx">
        <Box sx={{ maxWidth: 280, mb: 3 }}>
          <ListingCard listing={MOCK_LISTINGS[0]!} />
        </Box>
        <ListingGrid listings={MOCK_LISTINGS} />
      </Section>
      <Divider />

      <Section name="LoadingGrid" file="src/components/LoadingGrid.tsx">
        <LoadingGrid count={4} />
      </Section>
      <Divider />

      <Section name="EmptyState" file="src/components/EmptyState.tsx">
        <EmptyState
          icon={<SearchOffOutlinedIcon />}
          title="No listings match your filters"
          description="Try a wider price range or a different category."
          action={<Button variant="outlined">Clear filters</Button>}
        />
      </Section>
      <Divider />

      <Section name="Form fields and errors" file="@mui/material/TextField, Alert">
        <Stack spacing={2} sx={{ maxWidth: 420 }}>
          <TextField label="Title" placeholder="What are you selling?" fullWidth />
          <TextField label="Price" type="number" slotProps={{ htmlInput: { min: 0 } }} fullWidth />
          <TextField select label="Condition" defaultValue="good" fullWidth>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="like_new">Like new</MenuItem>
            <MenuItem value="good">Good</MenuItem>
            <MenuItem value="fair">Fair</MenuItem>
          </TextField>
          <TextField label="Description" multiline minRows={3} fullWidth />
          <Alert severity="error">Add at least one photo before posting.</Alert>
        </Stack>
      </Section>
      <Divider />

      <Section name="PageHeader" file="src/components/PageHeader.tsx">
        <Box sx={{ p: 3, bgcolor: tokens.paper, border: `1px solid ${tokens.line}`, borderRadius: 2 }}>
          <PageHeader
            title="My listings"
            description="Items you're selling right now."
            actions={<LinkButton href="/listings/new" variant="contained">Sell an item</LinkButton>}
          />
        </Box>
      </Section>
    </>
  );
}
