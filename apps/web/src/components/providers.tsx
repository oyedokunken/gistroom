"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <FeedbackProvider>{children}</FeedbackProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
