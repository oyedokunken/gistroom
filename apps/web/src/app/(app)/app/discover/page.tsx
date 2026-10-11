import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DiscoverView } from "@/components/interests/discover-view";
import { interests as copy } from "@/content/interests";
import { requireUserForPage } from "@/server/auth/page";
import { discover } from "@/server/interests/service";

export const metadata: Metadata = { title: copy.discoverMeta };
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { user } = await requireUserForPage();
  const data = await discover(user.id);
  return (
    <>
      <PageHeader title={copy.discoverTitle} />
      <DiscoverView data={data} />
    </>
  );
}
