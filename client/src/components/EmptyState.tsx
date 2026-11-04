import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/theme/tokens";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Usually one button telling people what to do next. */
  action?: React.ReactNode;
};

/** Shown when a list has nothing in it. Always point to the next step. */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        alignItems: "center",
        textAlign: "center",
        py: { xs: 6, sm: 8 },
        px: 3,
        border: `1px dashed ${tokens.line}`,
        borderRadius: 2,
        bgcolor: tokens.paper,
      }}
    >
      {icon && <Stack sx={{ color: tokens.muted, "& svg": { fontSize: 40 } }}>{icon}</Stack>}
      <Typography variant="h4" component="h2">
        {title}
      </Typography>
      {description && (
        <Typography sx={{ color: "text.secondary", maxWidth: "46ch" }}>{description}</Typography>
      )}
      {action && <Stack sx={{ pt: 1 }}>{action}</Stack>}
    </Stack>
  );
}
