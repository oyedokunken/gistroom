import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { AnimatedArt } from "@/components/public/animated-art";
import { nav } from "@/content/landing";

/** Two column auth layout: a calm form beside one animated scene. The art is decoration only, never text. */
export function AuthShell({ artId, children }: { artId: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col px-6 py-8 md:px-16 md:py-12">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            aria-label={nav.home}
            className="mb-10 inline-flex w-fit items-center gap-2"
          >
            <LogoMark size={32} className="text-green-600 dark:text-text" />
            <span className="text-xl font-black tracking-[-0.02em] text-text">gistroom</span>
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 pb-10">
          {children}
        </div>
      </main>
      <aside aria-hidden className="relative hidden bg-green-100 md:block">
        <AnimatedArt
          id={artId}
          alt=""
          width={1000}
          height={1200}
          priority
          sizes="(min-width: 768px) 50vw, 0px"
          className="absolute inset-0 size-full object-cover"
        />
      </aside>
    </div>
  );
}
