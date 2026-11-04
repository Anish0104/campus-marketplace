import LinkButton from "@/components/LinkButton";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

// Feed page. Aryan replaces the empty state with <ListingGrid listings={...} />.
export default function Home() {
  return (
    <>
      <PageHeader
        title="Browse listings"
        description="Textbooks, furniture and everything else, from Rutgers students only."
      />
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="No listings yet"
        description="Be the first to post something you no longer need."
        action={
          <LinkButton href="/listings/new" variant="contained">
            Sell an item
          </LinkButton>
        }
      />
    </>
  );
}
