import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { pages } from "@/content/app";

export const metadata: Metadata = { title: pages.calls.title };

export default function Page() {
  return (
    <>
      <PageHeader title={pages.calls.title} />
      <EmptyState artId="empty-calls" title={pages.calls.emptyTitle} body={pages.calls.emptyBody} />
    </>
  );
}
