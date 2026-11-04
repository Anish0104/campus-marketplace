"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import EmptyState from "@/components/EmptyState";
import LinkButton from "@/components/LinkButton";
import ListingGrid from "@/components/ListingGrid";
import LoadingGrid from "@/components/LoadingGrid";
import FeedFilterBar from "./FeedFilterBar";
import { ApiError } from "@/lib/api";
import { EMPTY_FILTERS, filtersToQuery, getFeed, getFeedCategories, hasActiveFilters, readFilters, type FeedFilters } from "@/lib/feed";
import { toListingSummary } from "@/lib/listings";
import type { FeedCategory, FeedPage } from "@/lib/types";

// Each result remembers which request it answers, so a slow old response
// never shows up after the filters or test account have changed.
type FeedResult = { key: string; data?: FeedPage; error?: ApiError };

const subscribeToHydration = () => () => {};

/** The home page feed: search, filters, results and paging. Filters live in the URL. */
export default function FeedView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const userId = user?.id;
  // The signed-in user is only known in the browser. Until then, show the loading grid.
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const queryString = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(queryString)), [queryString]);
  const apiQuery = filtersToQuery(filters);

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<FeedResult | null>(null);
  const [categories, setCategories] = useState<{ userId: string; list: FeedCategory[] } | null>(null);
  const key = `${userId}:${apiQuery}:${attempt}`;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    getFeed(userId, filters, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, error: error instanceof ApiError ? error : new ApiError("Couldn't load listings. Please try again.", 0) });
      });
    return () => controller.abort();
  }, [userId, filters, key]);

  // Categories for the filter menu. If this fails the menu still offers "All categories".
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    getFeedCategories(userId, controller.signal)
      .then((list) => { if (!controller.signal.aborted) setCategories({ userId, list }); })
      .catch(() => {});
    return () => controller.abort();
  }, [userId]);

  function navigate(next: FeedFilters, { push = false } = {}) {
    const query = filtersToQuery(next);
    const href = query ? `${pathname}?${query}` : pathname;
    if (push) router.push(href);
    else router.replace(href, { scroll: false });
  }

  function changePage(page: number) {
    navigate({ ...filters, page }, { push: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (hydrated && !user) {
    return (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="Sign in to browse listings"
        description="The marketplace is for Rutgers students only. Sign in, or pick a test account in the header."
      />
    );
  }

  const current = result?.key === key ? result : null;
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <FeedFilterBar
        filters={filters}
        categories={categories && categories.userId === userId ? categories.list : []}
        onChange={(next) => navigate(next)}
      />
      <FeedResults
        current={current}
        filters={filters}
        filtered={filtered}
        onRetry={() => setAttempt((n) => n + 1)}
        onClear={() => navigate({ ...EMPTY_FILTERS, sort: filters.sort })}
        onFirstPage={() => navigate({ ...filters, page: 1 })}
        onPage={changePage}
      />
    </>
  );
}

type FeedResultsProps = {
  current: FeedResult | null;
  filters: FeedFilters;
  filtered: boolean;
  onRetry: () => void;
  onClear: () => void;
  onFirstPage: () => void;
  onPage: (page: number) => void;
};

function FeedResults({ current, filters, filtered, onRetry, onClear, onFirstPage, onPage }: FeedResultsProps) {
  if (!current) return <LoadingGrid />;

  if (current.error) {
    return (
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Alert severity="error" sx={{ alignSelf: "stretch" }}>
          {current.error.message}
        </Alert>
        <Button variant="outlined" onClick={onRetry}>
          Try again
        </Button>
      </Stack>
    );
  }

  const { listings, total, totalPages, page } = current.data!;

  if (total === 0 && filtered) {
    return (
      <EmptyState
        icon={<SearchOffOutlinedIcon />}
        title="No listings match your filters"
        description={filters.q ? `Nothing found for “${filters.q}”. Try other words, a wider price range or a different category.` : "Try a wider price range or a different category."}
        action={<Button variant="outlined" onClick={onClear}>Clear filters</Button>}
      />
    );
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="No listings yet"
        description="Be the first to post something you no longer need."
        action={<LinkButton href="/listings/new" variant="contained">Sell an item</LinkButton>}
      />
    );
  }

  // A shared link can point past the last page once listings sell.
  if (listings.length === 0) {
    return (
      <EmptyState
        title="This page is empty"
        description={`There ${totalPages === 1 ? "is only 1 page" : `are only ${totalPages} pages`} of listings now.`}
        action={<Button variant="outlined" onClick={onFirstPage}>Go to the first page</Button>}
      />
    );
  }

  return (
    <>
      <Typography role="status" aria-live="polite" variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {resultLabel(total, filters.q)}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </Typography>
      <ListingGrid listings={listings.map(toListingSummary)} />
      {totalPages > 1 && (
        <Stack sx={{ alignItems: "center", mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => onPage(value)}
            color="primary"
            shape="rounded"
            siblingCount={1}
            getItemAriaLabel={(type, value, selected) =>
              type === "page" ? `${selected ? "Page" : "Go to page"} ${value}` : `Go to ${type} page`
            }
          />
        </Stack>
      )}
    </>
  );
}

function resultLabel(total: number, q: string) {
  const count = `${total} ${total === 1 ? "listing" : "listings"}`;
  return q ? `${count} for “${q}”` : count;
}
