"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import type { User } from "@/lib/types";

type CurrentUserContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acceptAuthentication: (user: User) => void;
  logout: () => Promise<void>;
};

const CurrentUserContext = createContext<CurrentUserContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  acceptAuthentication: () => {},
  logout: async () => {},
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await apiFetch<User>("/api/auth/me"));
      setError(null);
    } catch (cause) {
      setUser(null);
      setError(cause instanceof ApiError && cause.status !== 401 ? cause.message : null);
    } finally {
      setLoading(false);
    }
  }, []);

  const acceptAuthentication = useCallback((authenticatedUser: User) => {
    disconnectSocket();
    setUser(authenticatedUser);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
      disconnectSocket();
      setUser(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out. Please try again.");
    }
  }, []);

  return (
    <CurrentUserContext.Provider value={{ user, loading, error, refresh, acceptAuthentication, logout }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
