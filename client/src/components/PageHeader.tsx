import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Buttons shown on the right, e.g. <Button>Sell an item</Button> */
  actions?: React.ReactNode;
};

/** Title row at the top of every page. */
export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ mb: 3, alignItems: { xs: "flex-start", sm: "flex-end" }, justifyContent: "space-between" }}
    >
      <div>
        <Typography variant="h2" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography sx={{ color: "text.secondary", mt: 0.75, maxWidth: "62ch" }}>{description}</Typography>
        )}
      </div>
      {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
    </Stack>
  );
}
