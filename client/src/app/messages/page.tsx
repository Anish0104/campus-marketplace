import { Suspense } from "react";
import MessagesView from "@/components/messages/MessagesView";
import AuthGate from "@/components/AuthGate";

export const metadata = { title: "Messages · Campus Marketplace" };

export default function MessagesPage() {
  return (
    <Suspense>
      <AuthGate><MessagesView /></AuthGate>
    </Suspense>
  );
}
