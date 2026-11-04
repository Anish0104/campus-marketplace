"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { DEV_LOGIN_ENABLED, DEV_USERS } from "@/lib/devUsers";
import type { User } from "@/lib/types";

/**
 * Who is signed in. TEMPORARY: picks one of the test accounts and remembers it
 * in this browser. When sign-in lands (Krisha), replace the inside of this
 * provider with the real session. Pages only use `useCurrentUser()`.
 */
type CurrentUserContextValue = {
  user: User | null;
  setUserId: (id: string) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue>({
  user: null,
  setUserId: () => {},
});

const STORAGE_KEY = "cm:dev-user-id";
const listeners = new Set<() => void>();
let memoryUserId: string | null = null; // used when browser storage is blocked

function readUserId(): string | null {
  if (!DEV_LOGIN_ENABLED) return null;
  let saved = memoryUserId;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY) ?? memoryUserId;
  } catch {}
  return DEV_USERS.some((u) => u.id === saved) ? saved : DEV_USERS[0]!.id;
}

function writeUserId(id: string) {
  memoryUserId = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const userId = useSyncExternalStore(subscribe, readUserId, () => null);
  const user = DEV_USERS.find((u) => u.id === userId) ?? null;

  return (
    <CurrentUserContext.Provider value={{ user, setUserId: writeUserId }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
