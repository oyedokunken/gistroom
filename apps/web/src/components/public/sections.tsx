import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { AnimatedArt } from "./animated-art";
import { CardIcon, type CardIconName } from "./card-icon";
import { CtaFloat } from "./cta-float";
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
  icon,
  align = "left",
  className,
}: {
  id?: string;
  title: string;
  lead?: string;
  /** Custom PNG icon above the heading. */
  icon?: CardIconName;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn("mb-10 max-w-[44rem]", align === "center" && "mx-auto text-center", className)}
    >
      {icon ? <CardIcon name={icon} className="mb-4" /> : null}
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
  primary: { label: string; href: string; icon?: ReactNode };
  secondary?: { label: string; href: string };
}) {
  return (
    <>
      <Link href={primary.href} className={buttonStyles("accent", "min-h-12 px-8 text-base")}>
        {primary.icon}
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
  icon,
  action,
  reverse,
}: {
  id: string;
  title: string;
  body: string;
  points?: readonly string[];
  visual: ReactNode;
  /** Custom PNG icon above the heading. Desktop only, where it has room to breathe. */
  icon?: CardIconName;
  /** Button under the points that sends people to the feature. */
  action?: { label: string; href: string };
  reverse?: boolean;
}) {
  return (
    <div
      id={id}
      className="grid scroll-mt-28 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-20 lg:py-14"
    >
      <div className={cn(reverse && "lg:order-2")}>
        {icon ? <CardIcon name={icon} className="mb-5 hidden md:inline-flex" /> : null}
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
        {action ? (
          <Link
            href={action.href}
            className={buttonStyles("primary", "mt-8 min-h-12 w-fit px-7 text-base")}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className={cn("flex justify-center", reverse && "lg:order-1")}>{visual}</div>
    </div>
  );
}

export interface TileItem {
  title: string;
  body: string;
  /** Custom PNG icon shown above the heading. */
  icon?: CardIconName;
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
            "group flex flex-col justify-end rounded-card p-6 shadow-soft md:min-h-44",
            spans[i % spans.length],
            tone === "soft" ? fills[i % fills.length] : fills[i % fills.length],
          )}
        >
          {item.icon ? <CardIcon name={item.icon} className="mb-3" /> : null}
          <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
          <p className="mt-2 max-w-[48ch]">{item.body}</p>
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
        <li key={item.title} className="group border-t-4 border-green-600 pt-4">
          {item.icon ? <CardIcon name={item.icon} className="mb-3" /> : null}
          <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
          <p className="mt-2 max-w-[48ch] text-text-muted">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** A real sequence, shown with custom PNG icons when the item carries one. */
export function Steps({ items }: { items: readonly TileItem[] }) {
  return (
    <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <li
          key={item.title}
          className="group relative rounded-card bg-surface p-6 text-text shadow-soft"
        >
          {item.icon ? (
            <CardIcon name={item.icon} />
          ) : (
            <span className="tabular flex size-10 items-center justify-center rounded-full bg-yellow-400 text-lg font-black text-ink-950">
              {i + 1}
            </span>
          )}
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
  icon,
}: {
  title: string;
  body: string;
  tone?: Tone;
  /** Custom PNG icon drifting at the right end, on top on phones. */
  icon?: CardIconName;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-hero p-8 md:flex-row md:items-center md:justify-between md:gap-10 md:p-12",
        tones[tone],
      )}
    >
      {icon ? (
        <CtaFloat name={icon} className="block size-16 shrink-0 md:order-2 md:size-24" />
      ) : null}
      <div>
        <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="mt-3 max-w-[62ch] text-lg">{body}</p>
      </div>
    </div>
  );
}

/** Scene art available to call to action bands, with intrinsic size and alt text. */
const ctaScenes = {
  "scene-final-cta": {
    width: 1024,
    height: 819,
    alt: "Friends waving you in around a glowing circle of sound",
  },
  "scene-moderators": {
    width: 1024,
    height: 819,
    alt: "A moderator with a shield badge at a table with a mute button and a list of logged actions",
  },
  "scene-rooftop": {
    width: 1024,
    height: 1024,
    alt: "Four friends on a rooftop at night with a speaker, string lights and the city behind them",
  },
  "scene-barbershop": {
    width: 1024,
    height: 1024,
    alt: "A barber trimming a customer's hair while they talk, with a mirror and a radio on the shelf",
  },
  "scene-danfo": {
    width: 1024,
    height: 1024,
    alt: "A yellow danfo bus with its conductor waving, and three people chatting beside it",
  },
  "scene-suya": {
    width: 1024,
    height: 1024,
    alt: "A suya seller grilling skewers over glowing coals while two customers chat under a lantern",
  },
  "scene-football-centre": {
    width: 1024,
    height: 1024,
    alt: "Fans packed under a shed cheering at a big screen showing a match",
  },
  "scene-keke": {
    width: 1024,
    height: 1024,
    alt: "A yellow keke napep driving past a plantain stand",
  },
  "scene-street-football": {
    width: 1024,
    height: 1024,
    alt: "Two friends playing football on a street with a ball in mid-air",
  },
  "scene-village-square": {
    width: 1024,
    height: 1024,
    alt: "Friends gathered under a big tree on a village square, talking in a circle",
  },
  "scene-help-desk": {
    width: 1024,
    height: 1024,
    alt: "A helper behind a counter with a laptop, waving at a visitor, with a notes board behind them",
  },
  "scene-door-check": {
    width: 1024,
    height: 1024,
    alt: "A host at a green doorway with a rope line, checking a list while a guest waits to enter",
  },
  "scene-dev-desk": {
    width: 1024,
    height: 1024,
    alt: "A developer at a tidy desk writing code on a laptop, with a plant and a cup beside them",
  },
} as const;

export type CtaSceneName = keyof typeof ctaScenes;

export function CtaBand({
  title,
  body,
  primary,
  secondary,
  art = "scene-final-cta",
  icon,
}: {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Animated scene beside the words. Every page picks a different one. */
  art?: CtaSceneName;
  /** Custom PNG icon floating on the scene art. */
  icon?: CardIconName;
}) {
  const scene = ctaScenes[art];
  return (
    <section
      aria-label={title}
      className={cn("relative w-full overflow-hidden bg-green-700 text-white", dots)}
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-6 py-14 md:grid-cols-2 md:py-20">
        <div className="flex flex-col items-start justify-center gap-6 md:order-1">
          <h2 className="max-w-[18ch] text-[clamp(2.25rem,6vw,4rem)] font-black leading-[1.02] tracking-[-0.035em]">
            {title}
          </h2>
          <p className="max-w-[50ch] text-lg text-white/90">{body}</p>
          <div className="flex flex-wrap gap-3">
            <HeroActions primary={primary} secondary={secondary} />
          </div>
        </div>
        <div className="relative order-first md:order-2">
          <AnimatedArt
            id={art}
            alt={scene.alt}
            width={scene.width}
            height={scene.height}
            className="h-auto w-full rounded-hero object-cover shadow-lift"
          />
          {icon ? (
            <CtaFloat
              name={icon}
              className="absolute -left-2 top-3 block size-14 md:-left-3 md:size-20"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
