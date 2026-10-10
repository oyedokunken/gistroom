"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import {
  Bell,
  MessageCircle,
  Phone,
  Radio,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MeUser } from "@gistroom/shared";
import { LogoMark } from "@/components/brand/logo-mark";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { appNav } from "@/content/app";
import { nav } from "@/content/landing";
import { cn } from "@/lib/cn";
import { useUnreadCounts } from "@/lib/use-unread";

const icons: Record<string, LucideIcon> = {
  chats: MessageCircle,
  rooms: Radio,
  calls: Phone,
  friends: Users,
  notifications: Bell,
  settings: Settings,
  admin: ShieldCheck,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shows the welcome modal once after onboarding, then removes the query flag. */
function WelcomeGate() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showSuccess } = useFeedback();
  const welcome = params.get("welcome");
  useEffect(() => {
    if (!welcome) return;
    showSuccess(appNav.welcome, appNav.welcomeTitle);
    router.replace(pathname);
  }, [welcome, pathname, router, showSuccess]);
  return null;
}

export function AppShell({ user, children }: { user: MeUser; children: ReactNode }) {
  const pathname = usePathname();
  const unread = useUnreadCounts();
  const railItems = user.role === "ADMIN" ? [...appNav.items, appNav.admin] : appNav.items;
  // Phones get five tabs. Alerts move to a bell in the top bar.
  const tabItems = appNav.items.filter((i) => i.id !== "notifications");

  const badge = (id: string): number =>
    id === "notifications" ? unread.notifications : id === "chats" ? unread.chats : 0;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[4.75rem] shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-4 md:flex lg:w-56 lg:items-stretch lg:px-3">
        <Link
          href="/app/chats"
          aria-label={nav.home}
          className="mb-4 flex items-center gap-2 px-2 py-1"
        >
          <LogoMark size={34} className="shrink-0 text-text" />
          <span className="hidden text-lg font-bold tracking-tight text-text lg:inline">
            gistroom
          </span>
        </Link>
        <nav aria-label={appNav.label} className="flex flex-1 flex-col gap-1">
          {railItems.map((item) => {
            const Icon = icons[item.id] ?? Settings;
            const active = isActive(pathname, item.href);
            const count = badge(item.id);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  item.id === "notifications" ? appNav.notificationsAria(count) : undefined
                }
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-3 rounded-full px-3 text-[0.9375rem] font-medium transition-colors lg:justify-start",
                  active
                    ? "bg-green-100 text-green-700"
                    : "text-text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
                {count > 0 ? (
                  <span className="tabular absolute right-1.5 top-1 flex min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-ink-950 lg:static lg:ml-auto">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/app/settings/profile"
          className="mt-2 flex items-center justify-center gap-3 rounded-full p-2 hover:bg-surface-2 lg:justify-start"
        >
          <Avatar name={user.name} src={user.avatarUrl} size={36} />
          <span className="hidden min-w-0 flex-col text-left lg:flex">
            <span className="truncate text-sm font-semibold text-text">{user.name}</span>
            <span className="truncate text-xs text-text-muted">@{user.username}</span>
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
          <Link href="/app/chats" aria-label={nav.home} className="flex items-center gap-2">
            <LogoMark size={30} className="text-text" />
            <span className="text-lg font-bold tracking-tight text-text">gistroom</span>
          </Link>
          <Link
            href="/app/notifications"
            aria-label={appNav.notificationsAria(unread.notifications)}
            className="relative flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2"
          >
            <Bell aria-hidden className="size-5" />
            {unread.notifications > 0 ? (
              <span className="tabular absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-ink-950">
                {unread.notifications > 99 ? "99+" : unread.notifications}
              </span>
            ) : null}
          </Link>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>

      <nav
        aria-label={appNav.mobileLabel}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-center justify-around px-1 py-1">
          {tabItems.map((item) => {
            const Icon = icons[item.id] ?? Settings;
            const active = isActive(pathname, item.href);
            const count = badge(item.id);
            return (
              <li key={item.id} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs font-medium",
                    active ? "text-green-700" : "text-text-muted",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {item.label}
                </Link>
                {count > 0 ? (
                  <span className="tabular absolute right-1.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-ink-950">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <Suspense fallback={null}>
        <WelcomeGate />
      </Suspense>
    </div>
  );
}
