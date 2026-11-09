import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Pencil, Users } from "lucide-react";
import { BadgeList } from "@/components/badges/badge-row";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileActions } from "@/components/friends/profile-actions";
import { badgeCopy, profileExtras } from "@/content/badges";
import { friends } from "@/content/friends";
import { requireUserForPage } from "@/server/auth/page";
import { getProfile } from "@/server/people/profile";

export const metadata: Metadata = { title: "Profile" };

const monthYear = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" });

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
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-text">{profile.name}</h1>
        <p className="text-text-muted">@{profile.username}</p>
        {profile.emailVerified ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <BadgeCheck aria-hidden className="size-4" />
            {profileExtras.verified}
          </p>
        ) : isMe ? (
          <Link
            href="/app/settings/profile"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-text-muted underline-offset-4 hover:underline"
          >
            {profileExtras.unverified}
          </Link>
        ) : null}
      </div>
      {profile.bio ? <p className="max-w-prose text-text">{profile.bio}</p> : null}

      <ul
        aria-label={profileExtras.statsLabel}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-muted"
      >
        <li className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden className="size-4" />
          <time dateTime={profile.joinedAt}>
            {profileExtras.joined(monthYear.format(new Date(profile.joinedAt)))}
          </time>
        </li>
        <li className="tabular inline-flex items-center gap-1.5">
          <Users aria-hidden className="size-4" />
          {profileExtras.friends(profile.friendCount)}
        </li>
        {!isMe ? <li>{friends.mutual(profile.mutualFriends)}</li> : null}
        {!isMe && profile.friendsSince ? (
          <li>
            {friends.since(
              new Intl.DateTimeFormat("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(profile.friendsSince)),
            )}
          </li>
        ) : null}
      </ul>

      {profile.interests.length > 0 ? (
        <section aria-labelledby="profile-interests" className="flex flex-col items-center gap-2">
          <h2 id="profile-interests" className="text-sm font-semibold text-text-muted">
            {profileExtras.interestsHeading}
          </h2>
          <ul className="flex flex-wrap justify-center gap-2">
            {profile.interests.map((i) => (
              <li
                key={i.slug}
                className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-text"
              >
                {i.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="profile-badges" className="flex w-full flex-col items-center gap-3">
        <h2 id="profile-badges" className="text-xl font-bold text-text">
          {badgeCopy.heading}
        </h2>
        {profile.badgesHidden ? (
          <p className="text-text-muted">{badgeCopy.hiddenByOwner}</p>
        ) : profile.badges.length === 0 ? (
          <p className="max-w-md text-text-muted">{isMe ? badgeCopy.none : badgeCopy.noneOther}</p>
        ) : (
          <BadgeList badges={profile.badges} showPrivateNote={isMe} />
        )}
      </section>

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
