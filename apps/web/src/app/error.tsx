"use client";

import Link from "next/link";
import Image from "next/image";
import { Button, buttonStyles } from "@/components/ui/button";
import { serverError as copy } from "@/content/site";

/** Runtime error boundary for any page. Standalone, like the 404: no public header or footer. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface px-6 py-16 text-center">
      <Image
        src="/brand/lockup-stacked.png"
        alt="Gistroom"
        width={200}
        height={170}
        priority
        className="h-auto w-44"
      />
      <div className="flex max-w-[34rem] flex-col items-center gap-3">
        <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-text">
          {copy.heading}
        </h1>
        <p className="text-lg text-text-muted">{copy.body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button className="min-h-12 px-7" onClick={reset}>
          {copy.retry}
        </Button>
        <Link href="/" className={buttonStyles("secondary", "min-h-12 px-7")}>
          {copy.home}
        </Link>
      </div>
      <p className="text-sm text-text-muted">
        {copy.code}
        {error.digest ? `. ${copy.reference(error.digest)}` : ""}
      </p>
    </main>
  );
}
