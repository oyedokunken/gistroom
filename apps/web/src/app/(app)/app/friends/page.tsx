import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/app/page-shell";
import { FabRegister } from "@/components/fab/fab-register";
import { FriendsTabs } from "@/components/friends/friends-tabs";
import { friends } from "@/content/friends";

export const metadata: Metadata = { title: friends.title };

export default function FriendsPage() {
  return (
    <PageShell variant="full" title={friends.title}>
      <FabRegister place="friends" />
      <Suspense fallback={null}>
        <FriendsTabs />
      </Suspense>
    </PageShell>
  );
}
