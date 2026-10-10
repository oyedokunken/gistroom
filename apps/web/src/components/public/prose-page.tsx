import Link from "next/link";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";

export interface Section {
  id: string;
  heading: string;
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
  before?: ReactNode;
  after?: ReactNode;
}

/** Long form public page: one h1, then h2 sections in order. Line length stays under 80 characters. */
export function ProsePage({
  title,
  lead,
  updated,
  sections,
  cta,
  crumbs,
  before,
  after,
}: ProsePageProps) {
  return (
    <article className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-28 md:pt-36">
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
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
      <header className="max-w-[44rem]">
        <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] font-black leading-[1.05] tracking-[-0.03em] text-text">
          {title}
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg text-text-muted">{lead}</p>
        {updated ? <p className="mt-3 text-sm text-text-muted">{updated}</p> : null}
        {cta ? (
          <Link href={cta.href} className={buttonStyles("primary", "mt-6 min-h-12 px-7")}>
            {cta.label}
          </Link>
        ) : null}
      </header>
      {before}
      <div className="mt-12 flex max-w-[44rem] flex-col gap-10">
        {sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`} className="text-2xl font-bold tracking-tight text-text">
              {s.heading}
            </h2>
            {s.body?.map((p) => (
              <p key={p} className="mt-3 max-w-[68ch] text-text-muted">
                {p}
              </p>
            ))}
            {s.bullets ? (
              <ul className="mt-3 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-text-muted">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {s.extra}
          </section>
        ))}
      </div>
      {after}
    </article>
  );
}
