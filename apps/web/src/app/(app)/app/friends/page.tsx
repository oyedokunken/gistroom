import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/app/page-shell";
import { FriendsTabs } from "@/components/friends/friends-tabs";
import { friends } from "@/content/friends";

export const metadata: Metadata = { title: friends.title };

export default function FriendsPage() {
  return (
    <PageShell variant="full" title={friends.title}>
      <Suspense fallback={null}>
        <FriendsTabs />
      </Suspense>
    </PageShell>
  );
}
