"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False while React is attaching to the server-rendered HTML, true right after.
 * Use it to hold back anything the server could not know (like who is signed in),
 * so the first render matches the server HTML exactly and React does not report
 * a hydration mismatch (React error #418).
 */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
