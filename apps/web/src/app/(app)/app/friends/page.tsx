import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsTabs } from "@/components/friends/friends-tabs";
import { PageHeader } from "@/components/app/page-header";
import { friends } from "@/content/friends";

export const metadata: Metadata = { title: friends.title };

export default function FriendsPage() {
  return (
    <>
      <PageHeader title={friends.title} />
      <div className="mx-auto w-full max-w-3xl">
        <Suspense fallback={null}>
          <FriendsTabs />
        </Suspense>
      </div>
    </>
  );
}
