import type { Metadata } from "next";
import { PageShell } from "@/components/app/page-shell";
import { CallLog } from "@/components/call/call-log";
import { pages } from "@/content/app";

export const metadata: Metadata = { title: pages.calls.title };

export default function Page() {
  return (
    <PageShell variant="full" title={pages.calls.title}>
      <CallLog />
    </PageShell>
  );
}
