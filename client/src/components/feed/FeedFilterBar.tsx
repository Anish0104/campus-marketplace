"use client";

import { useState, type FormEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import { CONDITION_LABELS } from "@/components/ConditionChip";
import { EMPTY_FILTERS, filtersToQuery, hasActiveFilters, isValidPrice, SORT_LABELS, type FeedFilters } from "@/lib/feed";
import type { Condition, FeedCategory, FeedSort } from "@/lib/types";

type Draft = Pick<FeedFilters, "q" | "minPrice" | "maxPrice">;

type FeedFilterBarProps = {
  filters: FeedFilters;
  categories: FeedCategory[];
  onChange: (next: FeedFilters) => void;
};

const draftOf = (filters: FeedFilters): Draft => ({ q: filters.q, minPrice: filters.minPrice, maxPrice: filters.maxPrice });

/**
 * Search box plus category, condition, price and sort controls.
 * Menus apply as soon as they change. Typed fields (search and prices) apply on
 * Enter, the Search button, or when a price field loses focus, so the feed
 * doesn't reload on every keystroke. Any change goes back to page 1.
 */
export default function FeedFilterBar({ filters, categories, onChange }: FeedFilterBarProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(filters));
  // When the URL changes (Back button, "Clear filters", or our own apply), show its values.
  const current = filtersToQuery(filters);
  const [syncedFrom, setSyncedFrom] = useState(current);
  if (syncedFrom !== current) {
    setSyncedFrom(current);
    setDraft(draftOf(filters));
  }

  const minError = isValidPrice(draft.minPrice) ? "" : "Enter dollars, e.g. 10 or 9.99";
  const maxError = !isValidPrice(draft.maxPrice)
    ? "Enter dollars, e.g. 10 or 9.99"
    : draft.minPrice && draft.maxPrice && !minError && Number(draft.minPrice) > Number(draft.maxPrice)
      ? "Must be at least the minimum"
      : "";

  function apply(changes: Partial<FeedFilters>) {
    onChange({ ...filters, ...changes, page: 1 });
  }

  function applyDraft() {
    if (minError || maxError) return;
    const next = { q: draft.q.trim(), minPrice: draft.minPrice.trim(), maxPrice: draft.maxPrice.trim() };
    if (next.q !== filters.q || next.minPrice !== filters.minPrice || next.maxPrice !== filters.maxPrice) apply(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    applyDraft();
  }

  // Keep the current category selectable even if it has no active listings right now.
  const categoryNames = categories.map((c) => c.name);
  const categoryOptions = filters.category && !categoryNames.some((name) => name.toLowerCase() === filters.category.toLowerCase())
    ? [...categories, { name: filters.category, count: 0 }]
    : categories;
  const selectedCategory = categoryOptions.find((c) => c.name.toLowerCase() === filters.category.toLowerCase())?.name ?? "";

  const priceInput = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <Box component="form" role="search" aria-label="Search listings" onSubmit={submit} noValidate sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          type="search"
          placeholder="Search textbooks, furniture, electronics…"
          value={draft.q}
          onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
          fullWidth
          slotProps={{
            htmlInput: { "aria-label": "Search listings", maxLength: 100, enterKeyHint: "search" },
            input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> },
          }}
        />
        <Button type="submit" variant="contained" sx={{ flexShrink: 0 }}>
          Search
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))", md: "1.3fr 1.3fr 0.8fr 0.8fr 1.3fr" },
          alignItems: "start",
        }}
      >
        <TextField
          select
          label="Category"
          value={selectedCategory}
          onChange={(e) => apply({ category: e.target.value })}
          sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
        >
          <MenuItem value="">All categories</MenuItem>
          {categoryOptions.map((c) => (
            <MenuItem key={c.name} value={c.name}>
              {c.name}
              {c.count ? ` (${c.count})` : ""}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Condition"
          value={filters.conditions}
          onChange={(e) => {
            const value = e.target.value as unknown as Condition[] | string;
            apply({ conditions: typeof value === "string" ? (value.split(",") as Condition[]) : value });
          }}
          slotProps={{
            select: {
              multiple: true,
              displayEmpty: true,
              renderValue: (selected) => {
                const list = selected as Condition[];
                return list.length ? list.map((c) => CONDITION_LABELS[c]).join(", ") : "Any condition";
              },
            },
            inputLabel: { shrink: true },
          }}
          sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
        >
          {(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => (
            <MenuItem key={c} value={c}>
              {CONDITION_LABELS[c]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Min price"
          value={draft.minPrice}
          onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))}
          onBlur={applyDraft}
          error={!!minError}
          helperText={minError || " "}
          slotProps={{ htmlInput: priceInput, input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
        />

        <TextField
          label="Max price"
          value={draft.maxPrice}
          onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value }))}
          onBlur={applyDraft}
          error={!!maxError}
          helperText={maxError || " "}
          slotProps={{ htmlInput: priceInput, input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
        />

        <TextField
          select
          label="Sort by"
          value={filters.sort}
          onChange={(e) => apply({ sort: e.target.value as FeedSort })}
          sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
        >
          {(Object.keys(SORT_LABELS) as FeedSort[]).map((s) => (
            <MenuItem key={s} value={s}>
              {SORT_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {hasActiveFilters(filters) && (
        <Button variant="text" onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })} sx={{ mt: 0.5 }}>
          Clear filters
        </Button>
      )}
    </Box>
  );
}
