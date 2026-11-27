import { Suspense } from "react";
import AuthGate from "@/components/AuthGate";
import SavedView from "@/components/saved/SavedView";

export const metadata = { title: "Saved · Campus Marketplace" };

// Saved listings (Santanu). Signed-in students only.
export default function SavedPage() {
  return (
    <Suspense>
      <AuthGate><SavedView /></AuthGate>
    </Suspense>
  );
}
