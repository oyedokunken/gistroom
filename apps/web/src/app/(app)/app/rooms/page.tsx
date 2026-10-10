import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { pages } from "@/content/app";

export const metadata: Metadata = { title: pages.rooms.title };

export default function Page() {
  return (
    <>
      <PageHeader title={pages.rooms.title} />
      <EmptyState artId="empty-rooms" title={pages.rooms.emptyTitle} body={pages.rooms.emptyBody} />
    </>
  );
}
