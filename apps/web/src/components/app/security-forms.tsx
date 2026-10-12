"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { settings } from "@/content/app";

/** For people who forgot the current password: a code goes to their email, and they choose a new one. */
export function ResetByEmail({ email }: { email: string }) {
  const router = useRouter();
  const copy = settings.security;
  return (
    <section aria-labelledby="reset-h" className="flex flex-col gap-3">
      <h3 id="reset-h" className="text-lg font-bold text-text">
        {copy.resetHeading}
      </h3>
      <p className="text-text-muted">{copy.resetBody}</p>
      <Button
        variant="secondary"
        className="w-fit"
        onClick={() => router.push(`/forgot?email=${encodeURIComponent(email)}&auto=1`)}
      >
        {copy.resetAction}
      </Button>
    </section>
  );
}
