import type { Metadata } from "next";
import { home } from "@/content/site";

export const metadata: Metadata = {
  title: { absolute: home.title },
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[1200px] flex-col justify-center gap-6 px-6">
      <h1 className="text-[clamp(2.5rem,8vw,5rem)] font-black leading-[1.05] tracking-tight text-green-600">
        {home.heading}
      </h1>
      <p className="max-w-[60ch] text-lg text-text-muted">{home.subhead}</p>
      <p className="text-sm text-text-muted">{home.building}</p>
    </main>
  );
}
