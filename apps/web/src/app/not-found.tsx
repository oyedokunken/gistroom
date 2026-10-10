import type { Metadata } from "next";
import Link from "next/link";
import { DeadAir } from "@/components/system/dead-air";
import { buttonStyles } from "@/components/ui/button";
import { notFound as copy } from "@/content/site";

export const metadata: Metadata = { title: copy.title, robots: { index: false, follow: false } };

/**
 * The 404. It stands alone: no public header, no footer, no navigation chrome of any kind (owner rule).
 * Colors come from tokens, so it follows light and dark with the rest of the product.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-surface px-6 py-16 text-center">
      <DeadAir code={copy.code} flatlineLabel={copy.flatline} />
      <div className="flex max-w-[34rem] flex-col items-center gap-3">
        <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-text">
          {copy.heading}
        </h1>
        <p className="text-lg text-text-muted">{copy.body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonStyles("primary", "min-h-12 px-7")}>
          {copy.home}
        </Link>
        <Link href="/rooms" className={buttonStyles("secondary", "min-h-12 px-7")}>
          {copy.rooms}
        </Link>
      </div>
      <p className="text-sm text-text-muted">{copy.code}</p>
    </main>
  );
}
