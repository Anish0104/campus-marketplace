"use client";
import { useEffect, useState } from "react";
import { Alert, CircularProgress, Paper, Typography } from "@mui/material";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import type { MarketplaceRules } from "@/lib/types";
export default function RulesPage() {
  const [rules, setRules] = useState<MarketplaceRules | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<MarketplaceRules>("/api/rules", { signal: controller.signal }).then(setRules)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load rules."); });
    return () => controller.abort();
  }, []);
  return <><PageHeader title="Marketplace rules" description="Help keep our campus marketplace safe and welcoming." />
    {error ? <Alert severity="error">{error}</Alert> : !rules ? <CircularProgress aria-label="Loading rules" /> :
      <Paper variant="outlined" sx={{ p: 3 }}><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{rules.content}</Typography></Paper>}
  </>;
}
