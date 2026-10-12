import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/cn";

export type PageShellVariant = "full" | "narrow";

/**
 * One frame for every signed in page with a title. `full` uses the whole content width with the same gutters everywhere
 * (Discover, Rooms, Calls, Friends, Notifications). `narrow` is a centred column for forms (Settings, profiles).
 * The width is on `data-page-shell` so a test can check every route against its variant.
 */
export function PageShell({
  variant,
  title,
  action,
  children,
  className,
}: {
  variant: PageShellVariant;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <PageHeader title={title} action={action} />
      <div
        data-page-shell={variant}
        className={cn(
          "mx-auto w-full px-4 pb-28 pt-6 md:px-6",
          variant === "full" ? "max-w-[1400px]" : "max-w-[720px]",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
