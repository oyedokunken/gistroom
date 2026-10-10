import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/landing/hero";
import {
  CallsSwitch,
  ChatBento,
  DataSlider,
  Everywhere,
  HowItWorks,
  RoomSearchBox,
  SafeByDesign,
  TopicsStrip,
  TryRoom,
} from "@/components/landing/home-sections";
import { AlertsMock } from "@/components/mock/screens";
import { AnimatedArt } from "@/components/public/animated-art";
import { Faq } from "@/components/public/faq";
import { PublicPage } from "@/components/public/public-page";
import { RoomsExplorer } from "@/components/public/rooms-explorer";
import { Band, HeroActions, SectionHead } from "@/components/public/sections";
import { buttonStyles } from "@/components/ui/button";
import { homeCopy as copy } from "@/content/home";
import { cta } from "@/content/marketing";
import { faqItems } from "@/content/pages";
import { home } from "@/content/site";
import { faqJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";
import { rhythm } from "@/lib/rhythm";
import { listPublicRooms } from "@/server/rooms/public";

export const metadata: Metadata = {
  title: { absolute: home.title },
  alternates: { canonical: "/" },
};

const tones = rhythm.home;

export default async function HomePage() {
  const { rooms, failed } = await listPublicRooms();
  return (
    <PublicPage jsonLd={[organizationJsonLd(), websiteJsonLd(), faqJsonLd(faqItems)]}>
      <Hero />

      <Band tone={tones[1]} labelledBy="topics-h" className="overflow-hidden">
        <SectionHead id="topics-h" title={copy.topics.title} lead={copy.topics.lead} />
        <RoomSearchBox className="mb-8 max-w-2xl" />
        <TopicsStrip />
        <Link href="/rooms" className={buttonStyles("secondary", "mt-8")}>
          {copy.topics.all}
        </Link>
      </Band>

      <Band tone={tones[2]} labelledBy="how-h">
        <SectionHead id="how-h" title={copy.how.title} lead={copy.how.lead} />
        <HowItWorks />
      </Band>

      <Band tone={tones[3]} labelledBy="try-h">
        <SectionHead id="try-h" title={copy.tryRoom.title} lead={copy.tryRoom.lead} />
        <TryRoom />
      </Band>

      <Band tone={tones[4]} labelledBy="calls-h">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
          <div>
            <h2
              id="calls-h"
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
            >
              {copy.calls.title}
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg text-white/80">{copy.calls.lead}</p>
            <ul className="mt-6 flex flex-col gap-2 text-white/90">
              {copy.calls.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <CallsSwitch />
        </div>
      </Band>

      <Band tone={tones[5]} labelledBy="alerts-h">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
          <div className="md:order-2">
            <h2
              id="alerts-h"
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
            >
              {copy.alerts.title}
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg text-text-muted">{copy.alerts.lead}</p>
            <p className="mt-4 rounded-card bg-yellow-400 px-5 py-3 font-semibold text-ink-950">
              {copy.alerts.promise}
            </p>
            <ul className="mt-6 flex flex-col gap-2 text-text-muted">
              {copy.alerts.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center md:order-1">
            <AlertsMockPhone />
          </div>
        </div>
      </Band>

      <Band tone={tones[6]} labelledBy="everywhere-h">
        <SectionHead id="everywhere-h" title={copy.everywhere.title} lead={copy.everywhere.lead} />
        <Everywhere />
      </Band>

      <Band tone={tones[7]} labelledBy="discover-h" className="[&>div]:px-0 [&>div]:pb-4">
        <div className="px-6">
          <SectionHead id="discover-h" title={copy.discover.title} lead={copy.discover.lead} />
        </div>
        <RoomsExplorer bare initialRooms={rooms} initialQuery="" initialFailed={failed} />
      </Band>

      <Band tone={tones[8]} labelledBy="chat-h">
        <SectionHead id="chat-h" title={copy.chat.title} lead={copy.chat.lead} />
        <ChatBento />
      </Band>

      <Band tone={tones[9]} labelledBy="safe-h">
        <SectionHead id="safe-h" title={copy.safe.title} lead={copy.safe.lead} />
        <SafeByDesign />
      </Band>

      <Band tone={tones[10]} labelledBy="data-h">
        <SectionHead id="data-h" title={copy.data.title} lead={copy.data.lead} />
        <DataSlider />
      </Band>

      <Band tone={tones[11]} labelledBy="faq-h">
        <SectionHead id="faq-h" title={copy.faq.title} />
        <Faq items={faqItems} />
      </Band>

      <section aria-labelledby="final-h" className="w-full bg-green-700 text-white">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-6 py-20 md:grid-cols-2 md:py-28">
          <div className="flex flex-col items-start gap-6">
            <h2
              id="final-h"
              className="max-w-[14ch] text-[clamp(2.5rem,6vw,4.25rem)] font-black leading-[1.02] tracking-[-0.035em]"
            >
              {copy.final.title}
            </h2>
            <p className="max-w-[44ch] text-lg text-white/90">{copy.final.body}</p>
            <div className="flex flex-wrap gap-3">
              <HeroActions primary={cta.enter} secondary={cta.rooms} />
            </div>
          </div>
          <AnimatedArt
            id="scene-final-cta"
            alt="Friends waving you in around a glowing circle of sound"
            width={720}
            height={576}
            className="h-auto w-full"
          />
        </div>
      </section>
    </PublicPage>
  );
}

function AlertsMockPhone() {
  return <AlertsMock />;
}
