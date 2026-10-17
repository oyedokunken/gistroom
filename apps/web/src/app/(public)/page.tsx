import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Mic, MoonStar, PhoneCall } from "lucide-react";
import { Hero } from "@/components/landing/hero";
import { CallsSwitch, Everywhere } from "@/components/landing/calls-sections";
import { ChatBento } from "@/components/landing/chat-bento";
import { DataSlider, FinalCta, SafeByDesign } from "@/components/landing/closing-sections";
import { HowItWorks } from "@/components/landing/how-it-works";
import {
  RoomSearchBox,
  TopicCardsMarquee,
  TopicsStrip,
} from "@/components/landing/topics-sections";
import { TryRoom } from "@/components/landing/try-room";
import { AlertsMock } from "@/components/mock/screens";
import { CardIcon } from "@/components/public/card-icon";
import { Faq } from "@/components/public/faq";
import { PublicPage } from "@/components/public/public-page";
import { Band, SectionHead } from "@/components/public/sections";
import { buttonStyles } from "@/components/ui/button";
import { homeCopy as copy } from "@/content/home";
import { cta } from "@/content/marketing";
import { faqItems } from "@/content/pages";
import { home } from "@/content/site";
import { faqJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";
import { rhythm } from "@/lib/rhythm";

export const metadata: Metadata = {
  title: { absolute: home.title },
  alternates: { canonical: "/" },
};

const tones = rhythm.home;

const ALERT_POINT_ICONS = [PhoneCall, Bell, MoonStar] as const;

export default function HomePage() {
  return (
    <PublicPage jsonLd={[organizationJsonLd(), websiteJsonLd(), faqJsonLd(faqItems)]}>
      <Hero />

      <Band tone={tones[1]} labelledBy="topics-h" className="overflow-hidden">
        <SectionHead id="topics-h" title={copy.topics.title} lead={copy.topics.lead} />
        <div className="mb-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
          <RoomSearchBox className="flex-1" />
          <Link
            href="/rooms"
            className="inline-flex min-h-16 shrink-0 items-center justify-center gap-2 rounded-full bg-green-600 px-7 text-base font-semibold text-white transition-colors hover:bg-yellow-400"
          >
            <Mic aria-hidden className="size-5" />
            {copy.topics.all}
          </Link>
        </div>
        <TopicsStrip />
      </Band>

      <Band tone={tones[2]} labelledBy="how-h">
        <SectionHead id="how-h" title={copy.how.title} lead={copy.how.lead} />
        <HowItWorks />
      </Band>

      <Band tone={tones[3]} labelledBy="try-h">
        <SectionHead
          id="try-h"
          icon="open-gist"
          title={copy.tryRoom.title}
          lead={copy.tryRoom.lead}
        />
        <TryRoom />
      </Band>

      <Band tone={tones[4]} labelledBy="calls-h">
        <CallsSwitch />
      </Band>

      <Band tone={tones[5]} labelledBy="alerts-h">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
          <div className="order-2 md:order-2">
            <CardIcon name="alerts" className="mb-5" />
            <h2
              id="alerts-h"
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
            >
              {copy.alerts.title}
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg text-text-muted">{copy.alerts.lead}</p>
            <ul className="mt-6 flex flex-col gap-3 text-text-muted">
              {copy.alerts.points.map((p, i) => {
                const Icon = ALERT_POINT_ICONS[i % ALERT_POINT_ICONS.length] ?? Bell;
                return (
                  <li key={p} className="flex items-center gap-3">
                    <Icon aria-hidden className="size-4 shrink-0 text-green-600" />
                    <span>{p}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={cta.startRoom.href}
                className={buttonStyles("primary", "min-h-12 px-8 text-base")}
              >
                {cta.startRoom.label}
              </Link>
              <Link
                href={cta.joinRoom.href}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-green-600 px-8 text-base font-semibold text-green-700 transition-colors hover:bg-green-100"
              >
                {cta.joinRoom.label}
              </Link>
            </div>
          </div>
          <div className="order-1 flex justify-center md:order-1">
            <AlertsMockPhone />
          </div>
        </div>
      </Band>

      <Band tone={tones[6]} labelledBy="everywhere-h">
        <SectionHead
          id="everywhere-h"
          title={copy.everywhere.title}
          lead={copy.everywhere.lead}
          icon="open-gist"
        />
        <Everywhere />
      </Band>

      <Band tone={tones[7]} labelledBy="discover-h" className="[&>div]:px-0">
        <div className="px-6">
          <SectionHead
            id="discover-h"
            title={copy.discover.title}
            lead={copy.discover.lead}
            icon="voice"
          />
        </div>
        <TopicCardsMarquee />
      </Band>

      <Band tone={tones[8]} labelledBy="chat-h">
        <SectionHead id="chat-h" title={copy.chat.title} lead={copy.chat.lead} icon="friends" />
        <ChatBento />
      </Band>

      <Band tone={tones[9]} labelledBy="safe-h">
        <SafeByDesign />
      </Band>

      <Band tone={tones[10]} labelledBy="data-h">
        <DataSlider />
      </Band>

      <Band tone={tones[11]} labelledBy="faq-h">
        <SectionHead id="faq-h" title={copy.faq.title} lead={copy.faq.lead} icon="idea" />
        <Faq items={faqItems} />
      </Band>

      <section aria-labelledby="final-h" className="w-full bg-green-700 text-white">
        <FinalCta />
      </section>
    </PublicPage>
  );
}

function AlertsMockPhone() {
  return <AlertsMock />;
}
