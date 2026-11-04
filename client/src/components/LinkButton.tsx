"use client";

import Link from "next/link";
import Button, { type ButtonProps } from "@mui/material/Button";

/** A Button that navigates. Use it in server components instead of <Button component={Link}>. */
export default function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}
