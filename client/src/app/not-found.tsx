import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import EmptyState from "@/components/EmptyState";
import LinkButton from "@/components/LinkButton";

export default function NotFound() {
  return (
    <EmptyState
      icon={<SearchOffOutlinedIcon />}
      title="This page isn't here yet"
      description="It may still be in progress, or the link is wrong."
      action={
        <LinkButton href="/" variant="contained">
          Back to listings
        </LinkButton>
      }
    />
  );
}