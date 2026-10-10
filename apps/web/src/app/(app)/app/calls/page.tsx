import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { CallLog } from "@/components/call/call-log";
import { pages } from "@/content/app";

export const metadata: Metadata = { title: pages.calls.title };

export default function Page() {
  return (
    <>
      <PageHeader title={pages.calls.title} />
      <CallLog />
    </>
  );
}
