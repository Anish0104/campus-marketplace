import Chip from "@mui/material/Chip";
import type { Condition } from "@/lib/types";

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

export default function ConditionChip({ condition }: { condition: Condition }) {
  return (
    <Chip
      label={CONDITION_LABELS[condition]}
      size="small"
      variant="outlined"
      color={condition === "new" || condition === "like_new" ? "secondary" : "default"}
    />
  );
}
