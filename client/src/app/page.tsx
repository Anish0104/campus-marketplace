import { Suspense } from "react";
import LoadingGrid from "@/components/LoadingGrid";
import PageHeader from "@/components/PageHeader";
import FeedView from "@/components/feed/FeedView";
import AuthGate from "@/components/AuthGate";

// Feed page (Aryan): search, filters and the newest listings. Filters live in the URL.
export default function Home() {
  return (
    <>
      <PageHeader
        title="Browse listings"
        description="Textbooks, furniture and everything else, from Rutgers students only."
      />
      {/* FeedView reads the URL's search params, which needs a Suspense boundary. */}
      <Suspense fallback={<LoadingGrid />}>
        <AuthGate><FeedView /></AuthGate>
      </Suspense>
    </>
  );
}
