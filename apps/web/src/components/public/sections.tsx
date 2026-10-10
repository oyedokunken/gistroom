import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type Tone = "plain" | "soft" | "green" | "ink" | "yellow";

const tones: Record<Tone, string> = {
  plain: "bg-surface text-text",
  soft: "bg-surface-2 text-text",
  green: "bg-green-700 text-white",
  ink: "bg-ink-950 text-white",
  yellow: "bg-yellow-400 text-ink-950",
};

/** A full width band. The background runs edge to edge, the content stays on a 1200 pixel column. */
export function Band({
  tone = "plain",
  id,
  children,
  className,
  labelledBy,
}: {
  tone?: Tone;
  id?: string;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("w-full", tones[tone], className)}>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16 md:py-24">{children}</div>
    </section>
  );
}

export function SectionHead({
  id,
  title,
  lead,
  align = "left",
  className,
}: {
  id?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn("mb-10 max-w-[44rem]", align === "center" && "mx-auto text-center", className)}
    >
      <h2
        id={id}
        className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em]"
      >
        {title}
      </h2>
      {lead ? <p className="mt-3 text-lg opacity-80">{lead}</p> : null}
    </div>
  );
}

/** Dotted adire style tile used on the green hero. Drawn with CSS so it costs no download. */
const dots =
  "bg-[radial-gradient(circle_at_center,var(--color-green-600)_2px,transparent_2.5px)] bg-[length:28px_28px]";

export function PageHero({
  title,
  lead,
  actions,
  visual,
  crumbs,
}: {
  title: string;
  lead: string;
  actions?: ReactNode;
  visual?: ReactNode;
  crumbs?: readonly { name: string; href: string }[];
}) {
  return (
    <header className={cn("relative w-full overflow-hidden bg-green-700 text-white", dots)}>
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-6 pb-20 pt-32 md:pb-28 md:pt-44 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {crumbs?.length ? (
            <nav aria-label="Breadcrumb" className="mb-5 text-sm text-white/80">
              <ol className="flex flex-wrap gap-2">
                {crumbs.map((c, i) => (
                  <li key={c.href} className="flex items-center gap-2">
                    {i > 0 ? <span aria-hidden>/</span> : null}
                    {i === crumbs.length - 1 ? (
                      <span aria-current="page">{c.name}</span>
                    ) : (
                      <Link
                        href={c.href}
                        className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <h1 className="text-[clamp(2.5rem,6.5vw,4.5rem)] font-black leading-[1.02] tracking-[-0.035em]">
            {title}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg text-white/90 md:text-xl">{lead}</p>
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {visual ? (
          <div className="relative flex justify-center lg:justify-end">{visual}</div>
        ) : null}
      </div>
      <div aria-hidden className="h-3 w-full bg-yellow-400" />
    </header>
  );
}

export function HeroActions({
  primary,
  secondary,
}: {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <>
      <Link href={primary.href} className={buttonStyles("accent", "min-h-12 px-8 text-base")}>
        {primary.label}
      </Link>
      {secondary ? (
        <Link
          href={secondary.href}
          className="inline-flex min-h-12 items-center rounded-full border-2 border-white/70 px-8 text-base font-semibold text-white hover:bg-white/10"
        >
          {secondary.label}
        </Link>
      ) : null}
    </>
  );
}

/** Copy on one side, a device mock on the other. Reverse flips the order on wide screens. */
export function FeatureRow({
  id,
  title,
  body,
  points,
  visual,
  reverse,
}: {
  id: string;
  title: string;
  body: string;
  points?: readonly string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      id={id}
      className="grid scroll-mt-28 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-20 lg:py-14"
    >
      <div className={cn(reverse && "lg:order-2")}>
        <h2
          id={`${id}-h`}
          className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
        >
          {title}
        </h2>
        <p className="mt-4 max-w-[52ch] text-lg text-text-muted">{body}</p>
        {points?.length ? (
          <ul className="mt-6 flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check aria-hidden className="size-4" />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className={cn("flex justify-center", reverse && "lg:order-1")}>{visual}</div>
    </div>
  );
}

export interface TileItem {
  title: string;
  body: string;
}

/** A grid of tiles with different spans, so it does not read as identical cards. */
export function Bento({ items, tone = "plain" }: { items: readonly TileItem[]; tone?: Tone }) {
  const spans = [
    "lg:col-span-2",
    "",
    "",
    "lg:col-span-2",
    "lg:col-span-2",
    "",
    "",
    "lg:col-span-2",
  ];
  const fills = [
    "bg-green-600 text-white",
    "bg-surface text-text",
    "bg-yellow-100 text-ink-950",
    "bg-surface text-text",
    "bg-surface text-text",
    "bg-green-100 text-ink-950",
    "bg-ink-950 text-white",
    "bg-surface text-text",
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <li
          key={item.title}
          className={cn(
            "flex flex-col justify-end rounded-card p-6 shadow-soft md:min-h-44",
            spans[i % spans.length],
            tone === "soft" ? fills[i % fills.length] : fills[i % fills.length],
          )}
        >
          <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
          <p className="mt-2 max-w-[48ch] opacity-85">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Plain list of short statements with a heavy lead. Used for principles and guidelines. */
export function StatementGrid({ items }: { items: readonly TileItem[] }) {
  return (
    <ul className="grid gap-x-12 gap-y-8 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.title} className="border-t-4 border-green-600 pt-4">
          <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
          <p className="mt-2 max-w-[48ch] text-text-muted">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** A real sequence, so numbers are fine here. */
export function Steps({ items }: { items: readonly TileItem[] }) {
  return (
    <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <li key={item.title} className="relative rounded-card bg-surface p-6 text-text shadow-soft">
          <span className="tabular flex size-10 items-center justify-center rounded-full bg-yellow-400 text-lg font-black text-ink-950">
            {i + 1}
          </span>
          <h3 className="mt-4 text-xl font-bold tracking-tight">{item.title}</h3>
          <p className="mt-2 text-text-muted">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Facts({ items }: { items: readonly { value: string; label: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {items.map((f) => (
        <div
          key={f.label}
          className="flex flex-col-reverse justify-end rounded-card bg-white/10 p-6"
        >
          <dt className="mt-2 text-white/85">{f.label}</dt>
          <dd className="tabular text-[clamp(2.25rem,5vw,3.5rem)] font-black leading-none tracking-[-0.03em] text-yellow-400">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({
  title,
  body,
  tone = "yellow",
}: {
  title: string;
  body: string;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-hero p-8 md:p-12", tones[tone])}>
      <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-[-0.02em]">{title}</h2>
      <p className="mt-3 max-w-[62ch] text-lg">{body}</p>
    </div>
  );
}

export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section aria-label={title} className={cn("w-full bg-green-700 text-white", dots)}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-6 px-6 py-20 md:py-28">
        <h2 className="max-w-[18ch] text-[clamp(2.25rem,6vw,4rem)] font-black leading-[1.02] tracking-[-0.035em]">
          {title}
        </h2>
        <p className="max-w-[50ch] text-lg text-white/90">{body}</p>
        <div className="flex flex-wrap gap-3">
          <HeroActions primary={primary} secondary={secondary} />
        </div>
      </div>
    </section>
  );
}
