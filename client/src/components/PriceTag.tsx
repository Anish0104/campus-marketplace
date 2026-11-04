import Box from "@mui/material/Box";
import { formatPrice } from "@/lib/format";
import { tokens } from "@/theme/tokens";

type PriceTagProps = {
  price: number;
  size?: "small" | "large";
};

/** The scarlet hang-tag used for every price in the app. */
export default function PriceTag({ price, size = "small" }: PriceTagProps) {
  const large = size === "large";
  const notch = large ? 16 : 12;
  return (
    <Box
      component="span"
      aria-label={`Price: ${formatPrice(price)}`}
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: large ? 40 : 30,
        pl: `${notch + (large ? 12 : 9)}px`,
        pr: large ? 2 : 1.25,
        bgcolor: price === 0 ? tokens.raritan : tokens.scarlet,
        color: "#FFFFFF",
        fontFamily: '"Bricolage Grotesque Variable", system-ui, sans-serif',
        fontWeight: 700,
        fontSize: large ? "1.35rem" : "1rem",
        lineHeight: 1,
        borderRadius: "0 6px 6px 0",
        clipPath: `polygon(${notch}px 0, 100% 0, 100% 100%, ${notch}px 100%, 0 50%)`,
        // Punched hole
        "&::before": {
          content: '""',
          position: "absolute",
          left: notch - (large ? 2 : 1),
          top: "50%",
          width: large ? 7 : 6,
          height: large ? 7 : 6,
          borderRadius: "50%",
          bgcolor: tokens.paper,
          transform: "translateY(-50%)",
        },
      }}
    >
      {formatPrice(price)}
    </Box>
  );
}
