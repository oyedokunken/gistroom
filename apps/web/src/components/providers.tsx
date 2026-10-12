"use client";

import { useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthStateProvider } from "@/components/system/auth-state-provider";
import { ConsentBanner } from "@/components/system/consent-banner";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={200}>
          <FeedbackProvider>
            {children}
            <ConsentBanner />
            <AuthStateProvider />
          </FeedbackProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}
