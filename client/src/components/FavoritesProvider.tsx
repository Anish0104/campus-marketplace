"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useCurrentUser } from "./CurrentUserProvider";
import { getFavoriteIds, saveListing, unsaveListing } from "@/lib/favorites";

/**
 * Which listings the signed-in student has saved (Santanu). Loaded once per
 * sign-in so every heart button on every page agrees, and updated right away
 * when one is clicked. Signed-out visitors have nothing saved.
 */
type FavoritesContextValue = {
  /** False until the saved ids for the current user have loaded. */
  ready: boolean;
  isSaved: (listingId: string) => boolean;
  isPending: (listingId: string) => boolean;
  setSaved: (listingId: string, saved: boolean) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesContextValue>({
  ready: false,
  isSaved: () => false,
  isPending: () => false,
  setSaved: async () => false,
});

type Loaded = { userId: string; ids: Set<string> };

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    getFavoriteIds(controller.signal)
      .then((ids) => { if (!controller.signal.aborted) setLoaded({ userId, ids: new Set(ids) }); })
      // Hearts then start empty; saving still works and the Saved page shows the truth.
      .catch(() => { if (!controller.signal.aborted) setLoaded({ userId, ids: new Set() }); });
    return () => controller.abort();
  }, [userId]);

  // A different (or no) user never sees the previous user's saved ids.
  const current = loaded && loaded.userId === userId ? loaded : null;

  const setSaved = useCallback(async (listingId: string, saved: boolean) => {
    if (!userId || pendingRef.current.has(listingId)) return false;
    pendingRef.current.add(listingId);
    setPending(new Set(pendingRef.current));
    const update = (want: boolean) =>
      setLoaded((prev) => {
        if (!prev || prev.userId !== userId) return prev;
        const ids = new Set(prev.ids);
        if (want) ids.add(listingId); else ids.delete(listingId);
        return { userId, ids };
      });
    update(saved); // show the change at once, undo it if the server refuses
    try {
      await (saved ? saveListing(listingId) : unsaveListing(listingId));
      return true;
    } catch (cause) {
      update(!saved);
      setError(cause instanceof Error ? cause.message : "Couldn't update your saved listings. Please try again.");
      return false;
    } finally {
      pendingRef.current.delete(listingId);
      setPending(new Set(pendingRef.current));
    }
  }, [userId]);

  const value: FavoritesContextValue = {
    ready: Boolean(current),
    isSaved: (listingId) => current?.ids.has(listingId) ?? false,
    isPending: (listingId) => pending.has(listingId),
    setSaved,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" onClose={() => setError(null)} variant="filled">{error}</Alert>
      </Snackbar>
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
