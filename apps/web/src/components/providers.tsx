"use client";

import type { ReactNode } from "react";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <FeedbackProvider>{children}</FeedbackProvider>
    </TooltipProvider>
  );
}
