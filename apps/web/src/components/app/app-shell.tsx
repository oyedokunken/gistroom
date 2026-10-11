"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Compass,
  MessageCircle,
  Phone,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MeUser } from "@gistroom/shared";
import { AppRuntime } from "@/components/app/app-runtime";
import { LogoMark } from "@/components/brand/logo-mark";
import { TourHost, startTour } from "@/components/app/tour";
import { WelcomeBack } from "@/components/app/welcome-back";
import { ChatFab } from "@/components/chat/chat-fab";
import { SearchDialog, openSearch } from "@/components/search/search-dialog";
import { Avatar } from "@/components/ui/avatar";
import { appNav } from "@/content/app";
import { nav } from "@/content/landing";
import { cn } from "@/lib/cn";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { useUnreadCounts } from "@/lib/use-unread";

const icons: Record<string, LucideIcon> = {
  discover: Compass,
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

/** Starts the walkthrough once after onboarding, then removes the query flag. */
function WelcomeGate({ name }: { name: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [backOpen, setBackOpen] = useState(false);
  const welcome = params.get("welcome");
  const back = params.get("back");
  useEffect(() => {
    if (!welcome && !back) return;
    if (welcome) startTour();
    else setBackOpen(true);
    router.replace(pathname);
  }, [welcome, back, pathname, router]);
  return <WelcomeBack name={name} open={backOpen} onOpenChange={setBackOpen} />;
}

export function AppShell({ user, children }: { user: MeUser; children: ReactNode }) {
  const pathname = usePathname();
  const unread = useUnreadCounts();
  // The top bar carries the four places people live in. Alerts, settings and the profile sit on its right.
  const mainItems = appNav.items.filter((i) =>
    ["discover", "chats", "rooms", "calls", "friends"].includes(i.id),
  );
  // Phones get five tabs. Alerts move to a bell in the top bar.
  const tabItems = appNav.items.filter((i) => i.id !== "notifications" && i.id !== "discover");

  const badge = (id: string): number =>
    id === "notifications" ? unread.notifications : id === "chats" ? unread.chats : 0;

  return (
    <RealtimeProvider userId={user.id}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <Link href="/app/chats" aria-label={nav.home} className="flex items-center gap-2">
              <LogoMark size={36} className="shrink-0 text-text" />
              <span className="hidden text-lg font-bold tracking-tight text-text xl:inline">
                gistroom
              </span>
            </Link>
            <button
              type="button"
              onClick={openSearch}
              className="flex h-10 min-w-0 max-w-64 flex-1 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm text-text-muted hover:bg-green-100"
            >
              <Search aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{appNav.searchPeople}</span>
            </button>
          </div>
          <nav aria-label={appNav.label} className="flex items-stretch gap-1 self-stretch">
            {mainItems.map((item) => {
              const Icon = icons[item.id] ?? Settings;
              const active = isActive(pathname, item.href);
              const count = badge(item.id);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "group relative flex w-16 items-center justify-center border-b-[3px] transition-colors lg:w-24",
                    active
                      ? "border-green-600 text-green-700"
                      : "border-transparent text-text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <Icon aria-hidden className="size-6" />
                  {count > 0 ? (
                    <span className="tabular absolute right-2 top-2 flex min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-ink-950 lg:right-5">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-end gap-1">
            {user.role === "ADMIN" ? (
              <Link
                href={appNav.admin.href}
                aria-label={appNav.admin.label}
                title={appNav.admin.label}
                className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text hover:bg-green-100"
              >
                <ShieldCheck aria-hidden className="size-5" />
              </Link>
            ) : null}
            <Link
              href="/app/notifications"
              aria-label={appNav.notificationsAria(unread.notifications)}
              title={appNav.alertsLabel}
              className="relative flex size-10 items-center justify-center rounded-full bg-surface-2 text-text hover:bg-green-100"
            >
              <Bell aria-hidden className="size-5" />
              {unread.notifications > 0 ? (
                <span className="tabular absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-ink-950">
                  {unread.notifications > 99 ? "99+" : unread.notifications}
                </span>
              ) : null}
            </Link>
            <Link
              href="/app/settings"
              aria-label={appNav.settingsLabel}
              title={appNav.settingsLabel}
              className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text hover:bg-green-100"
            >
              <Settings aria-hidden className="size-5" />
            </Link>
            <Link
              href="/app/settings/profile"
              aria-label={user.name}
              title={user.name}
              className="ml-1 flex size-10 items-center justify-center rounded-full ring-2 ring-transparent hover:ring-green-600"
            >
              <Avatar name={user.name} src={user.avatarUrl} size={40} />
            </Link>
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
            <Link href="/app/chats" aria-label={nav.home} className="flex items-center gap-2">
              <LogoMark size={30} className="text-text" />
              <span className="text-lg font-bold tracking-tight text-text">gistroom</span>
            </Link>
            <div className="flex items-center">
              <button
                type="button"
                onClick={openSearch}
                aria-label={appNav.searchLabel}
                className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2"
              >
                <Search aria-hidden className="size-5" />
              </button>
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
            </div>
          </header>
          <AppRuntime />
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

        <ChatFab />
        <SearchDialog />
        <TourHost autoStart={false} />
        <Suspense fallback={null}>
          <WelcomeGate name={user.name} />
        </Suspense>
      </div>
    </RealtimeProvider>
  );
}
