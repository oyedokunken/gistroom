"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, LogOut, Settings, UserRound, type LucideIcon } from "lucide-react";
import { useSignOut } from "@/components/app/use-sign-out";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet } from "@/components/ui/sheet";
import { appNav } from "@/content/app";
import { useMediaQuery } from "@/lib/use-media-query";

export interface MenuPerson {
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface Entry {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  count?: number;
  danger?: boolean;
  onSelect?: () => void;
}

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="tabular ml-auto flex min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-ink-950">
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * The person's avatar, which opens their menu: profile, settings, notifications with the unread count, and log out.
 * A dropdown on wide screens and a bottom sheet on phones. Log out always asks first.
 */
export function AvatarMenu({
  person,
  unread = 0,
  size = 40,
  extra,
}: {
  person: MenuPerson;
  unread?: number;
  size?: number;
  /** Entries put above the standard ones, for example a link into the app from a public page. */
  extra?: { id: string; label: string; icon: LucideIcon; href: string }[];
}) {
  const router = useRouter();
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const { signOut } = useSignOut();

  const entries: Entry[] = [
    ...(extra ?? []),
    {
      id: "profile",
      label: appNav.menu.profile,
      icon: UserRound,
      href: `/app/u/${person.username}`,
    },
    { id: "settings", label: appNav.menu.settings, icon: Settings, href: "/app/settings" },
    {
      id: "notifications",
      label: appNav.menu.notifications,
      icon: Bell,
      href: "/app/notifications",
      count: unread,
    },
    {
      id: "logout",
      label: appNav.menu.logout,
      icon: LogOut,
      danger: true,
      onSelect: () => void signOut(),
    },
  ];

  const triggerClass =
    "flex size-11 items-center justify-center rounded-full ring-2 ring-transparent hover:ring-green-600 focus-visible:ring-green-600";

  if (!wide) {
    return (
      <>
        <button
          type="button"
          aria-label={appNav.menu.open(person.name)}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={triggerClass}
        >
          <Avatar name={person.name} src={person.avatarUrl} size={size} />
        </button>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title={person.name}
          description={`@${person.username}`}
        >
          <ul className="flex flex-col gap-1">
            {entries.map((e) => (
              <li key={e.id}>
                {e.href ? (
                  <Link
                    href={e.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base text-text hover:bg-surface-2"
                  >
                    <e.icon aria-hidden className="size-5 text-text-muted" />
                    {e.label}
                    <Count n={e.count ?? 0} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      e.onSelect?.();
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base hover:bg-surface-2 ${e.danger ? "text-danger-600" : "text-text"}`}
                  >
                    <e.icon aria-hidden className="size-5" />
                    {e.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownTrigger asChild>
        <button type="button" aria-label={appNav.menu.open(person.name)} className={triggerClass}>
          <Avatar name={person.name} src={person.avatarUrl} size={size} />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        <div className="px-3 py-2">
          <p className="truncate font-semibold text-text">{person.name}</p>
          <p className="truncate text-sm text-text-muted">@{person.username}</p>
        </div>
        <DropdownSeparator />
        {entries.map((e) =>
          e.id === "logout" ? (
            <div key={e.id}>
              <DropdownSeparator />
              <DropdownItem icon={e.icon} danger onSelect={() => e.onSelect?.()}>
                {e.label}
              </DropdownItem>
            </div>
          ) : (
            <DropdownItem key={e.id} icon={e.icon} onSelect={() => e.href && router.push(e.href)}>
              {e.label}
              <Count n={e.count ?? 0} />
            </DropdownItem>
          ),
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}
