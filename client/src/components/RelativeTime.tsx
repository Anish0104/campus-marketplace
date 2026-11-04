"use client";

import { useSyncExternalStore } from "react";
import { timeAgo } from "@/lib/format";

const subscribe = (notify: () => void) => {
  const id = window.setInterval(notify, 60_000);
  return () => window.clearInterval(id);
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "5m", "3h", "2d"… computed in the browser and refreshed every minute. */
export default function RelativeTime({ iso }: { iso: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => timeAgo(iso),
    () => shortDate(iso) // server render: a stable date, no clock needed
  );
  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()}>
      {label}
    </time>
  );
}
