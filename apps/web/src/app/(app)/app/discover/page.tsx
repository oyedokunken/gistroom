import type { Metadata } from "next";
import { PageShell } from "@/components/app/page-shell";
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
    <PageShell variant="full" title={copy.discoverTitle}>
      <DiscoverView data={data} />
    </PageShell>
  );
}
