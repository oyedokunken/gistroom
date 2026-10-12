import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileActions } from "@/components/friends/profile-actions";
import { friends } from "@/content/friends";
import { requireUserForPage } from "@/server/auth/page";
import { getProfile } from "@/server/people/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { user } = await requireUserForPage();
  const { username } = await params;
  const profile = await getProfile(user, username);
  if (!profile) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          icon="open-gist"
          title={friends.profilePage.notFoundTitle}
          body={friends.profilePage.notFoundBody}
        />
      </div>
    );
  }
  const isMe = profile.id === user.id;
  return (
    <div
      data-page-shell="narrow"
      className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-5 px-6 py-10 text-center"
    >
      <Avatar name={profile.name} src={profile.avatarUrl} size={112} />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-text">{profile.name}</h1>
        <p className="text-text-muted">@{profile.username}</p>
      </div>
      {profile.bio ? <p className="max-w-prose text-text">{profile.bio}</p> : null}
      {!isMe ? (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-text-muted">{friends.mutual(profile.mutualFriends)}</p>
          {profile.friendsSince ? (
            <p className="text-sm text-text-muted">
              {friends.since(
                new Intl.DateTimeFormat("en-NG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(profile.friendsSince)),
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      {isMe ? (
        <Link href="/app/settings/profile" className={buttonStyles("secondary", "gap-2")}>
          <Pencil aria-hidden className="size-4" />
          {friends.profilePage.edit}
        </Link>
      ) : (
        <ProfileActions profile={profile} />
      )}
    </div>
  );
}
