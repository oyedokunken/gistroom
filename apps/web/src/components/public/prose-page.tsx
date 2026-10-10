import type { ReactNode } from "react";
import { CardIcon, type CardIconName } from "./card-icon";
import { HeroActions, PageHero } from "./sections";
import { ContentsBar, ContentsRail } from "./contents-nav";

export interface Section {
  id: string;
  heading: string;
  /** Custom PNG icon above the heading. */
  icon?: CardIconName;
  body?: readonly string[];
  bullets?: readonly string[];
  /** Extra content such as a form or a table, rendered after the text. */
  extra?: ReactNode;
}

export interface ProsePageProps {
  title: string;
  lead: string;
  updated?: string;
  sections: readonly Section[];
  cta?: { label: string; href: string };
  crumbs?: readonly { name: string; href: string }[];
  /** Art shown beside the hero words on wide screens. */
  visual?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
}

const LINK_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/[^\s]+)/g;

/** Emails and URLs inside page copy become real links. Light pages use the green link. */
function linkify(text: string): ReactNode[] {
  return text.split(LINK_PATTERN).map((part, i) => {
    if (!part) return null;
    const isEmail = /^[^\s/]+@[^\s/]+$/.test(part);
    const isUrl = /^https?:\/\//.test(part);
    if (!isEmail && !isUrl) return part;
    return (
      <a
        key={`${part}-${i}`}
        href={isEmail ? `mailto:${part}` : part}
        className="font-semibold text-green-700 underline decoration-green-600/40 underline-offset-4 transition-colors hover:text-green-600"
      >
        {part}
      </a>
    );
  });
}

/**
 * Long form public page: a full width hero, then a contents list that stays in view beside the sections.
 * Text lines stay under 80 characters, the page itself uses the full 1200 pixel column.
 */
export function ProsePage({
  title,
  lead,
  updated,
  sections,
  cta,
  crumbs,
  visual,
  before,
  after,
}: ProsePageProps) {
  const hasNav = sections.length > 2;
  return (
    <>
      <PageHero
        title={title}
        lead={updated ? `${lead} ${updated}` : lead}
        crumbs={crumbs}
        actions={cta ? <HeroActions primary={cta} /> : undefined}
        visual={visual}
      />
      {before}
      {hasNav ? <ContentsBar items={sections} label="On this page" /> : null}
      <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-6 py-16 md:py-24 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-20">
        {hasNav ? <ContentsRail items={sections} label="On this page" /> : null}
        <div className={`flex flex-col gap-14 ${hasNav ? "" : "lg:col-span-2 lg:max-w-[52rem]"}`}>
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-h`}
              className="group scroll-mt-28"
            >
              {s.icon ? <CardIcon name={s.icon} className="mb-4" /> : null}
              <h2
                id={`${s.id}-h`}
                className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] text-text"
              >
                {s.heading}
              </h2>
              {s.body?.map((p) => (
                <p key={p} className="mt-4 max-w-[68ch] text-lg text-text-muted">
                  {linkify(p)}
                </p>
              ))}
              {s.bullets ? (
                <ul className="mt-4 flex max-w-[68ch] list-disc flex-col gap-2.5 pl-5 text-lg text-text-muted marker:text-green-600">
                  {s.bullets.map((b) => (
                    <li key={b}>{linkify(b)}</li>
                  ))}
                </ul>
              ) : null}
              {s.extra}
            </section>
          ))}
        </div>
      </div>
      {after}
    </>
  );
}
