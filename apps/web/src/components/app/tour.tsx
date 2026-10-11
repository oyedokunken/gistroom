"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  MessageCircle,
  Mic,
  Phone,
  Radio,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { tour } from "@/content/tour";
import { cn } from "@/lib/cn";

const icons: Record<(typeof tour.steps)[number]["icon"], LucideIcon> = {
  sparkles: Sparkles,
  message: MessageCircle,
  mic: Mic,
  phone: Phone,
  radio: Radio,
  bell: Bell,
  shield: ShieldCheck,
};

export const TOUR_EVENT = "gr:tour";
const SEEN_KEY = "gr_tour_seen";

export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private windows can refuse storage. The tour then just offers itself again next time.
  }
}

/** One walkthrough for the whole app. It opens on the first visit after sign up, and any "Take the tour" button reopens it. */
export function TourHost({ autoStart }: { autoStart: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const begin = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(TOUR_EVENT, begin);
    return () => window.removeEventListener(TOUR_EVENT, begin);
  }, [begin]);

  useEffect(() => {
    if (!autoStart) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) begin();
  }, [autoStart, begin]);

  const total = tour.steps.length;
  const current = tour.steps[step] ?? tour.steps[0]!;
  const last = step === total - 1;
  const close = (value: boolean) => {
    setOpen(value);
    if (!value) markSeen();
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      icon={icons[current.icon]}
      title={current.title}
      description={current.body}
      footer={
        <>
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              {tour.back}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => close(false)}>
              {tour.skip}
            </Button>
          )}
          <Button onClick={() => (last ? close(false) : setStep(step + 1))}>
            {last ? tour.done : tour.next}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2" aria-live="polite">
        <div className="flex gap-1.5" aria-hidden>
          {tour.steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-green-600" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
        <p className="text-sm text-text-muted">{tour.stepOf(step + 1, total)}</p>
      </div>
    </Modal>
  );
}

export function TourButton({ className }: { className?: string }) {
  return (
    <Button variant="secondary" className={className} onClick={startTour}>
      <Sparkles aria-hidden className="size-4" />
      {tour.open}
    </Button>
  );
}
