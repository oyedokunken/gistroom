import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { settings } from "@/content/app";

/** Phones only. On wider screens the sidebar is already visible. */
export function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-green-700 md:hidden"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {settings.back}
    </Link>
  );
}
