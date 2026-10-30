"use client";

import { useEffect, useState } from "react";
import Chip from "@mui/material/Chip";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Shows whether the backend is reachable. Handy while setting things up.
export default function ApiStatus() {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => setStatus(res.ok ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  const label =
    status === "checking" ? "Checking backend..." : status === "ok" ? "Backend connected" : "Backend not running";
  const color = status === "ok" ? "success" : status === "down" ? "error" : "default";

  return <Chip label={label} color={color} variant="outlined" />;
}
