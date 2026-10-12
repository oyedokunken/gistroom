"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { AvatarMenu } from "@/components/app/avatar-menu";
import { buttonStyles } from "@/components/ui/button";
import { cta } from "@/content/marketing";
import { selectSignedIn, useAuthState } from "@/lib/auth-state";

export interface Cta {
  label: string;
  href: string;
}

/** The call to action that says "Enter Gistroom" to visitors says "Open Gistroom" to people who are signed in. */
export function useAuthCta(base: Cta): Cta & { signedIn: boolean } {
  const signedIn = useAuthState(selectSignedIn);
  const isEnter = base.label === cta.enter.label;
  if (signedIn && isEnter) return { label: cta.open.label, href: cta.open.href, signedIn };
  return { ...base, signedIn };
}

/**
 * A link that follows the sign in state. Both labels are about the same width and the button keeps a minimum width,
 * so changing from one to the other moves nothing on the page.
 */
export function AuthLink({
  to,
  className,
  children,
  icon,
}: {
  to: Cta;
  className?: string;
  /** Replaces the label, for places that draw their own contents. */
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const resolved = useAuthCta(to);
  return (
    <Link href={resolved.href} className={className}>
      {icon}
      {children ?? resolved.label}
    </Link>
  );
}

/** The desktop dock account area: the main button, plus the avatar and its menu once someone is signed in. */
export function DockAccount() {
  const person = useAuthState((s) => s.person);
  const signedIn = useAuthState(selectSignedIn);
  const resolved = useAuthCta(cta.enter);
  return (
    <>
      <Link
        href={signedIn ? cta.open.href : "/login"}
        className={buttonStyles("primary", "min-w-[8.5rem] px-4 md:px-6")}
      >
        {resolved.label}
      </Link>
      {signedIn && person ? (
        <AvatarMenu
          person={person}
          size={36}
          extra={[
            { id: "open", label: cta.open.label, icon: LayoutDashboard, href: cta.open.href },
          ]}
        />
      ) : null}
    </>
  );
}
