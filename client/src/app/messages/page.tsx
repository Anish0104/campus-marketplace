import { Suspense } from "react";
import MessagesView from "@/components/messages/MessagesView";

export const metadata = { title: "Messages · Campus Marketplace" };

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
