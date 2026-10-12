import type { Metadata } from "next";
import { PageShell } from "@/components/app/page-shell";
import { DiscoverView } from "@/components/discover/discover-view";
import { discover as copy } from "@/content/discover";
import { requireUserForPage } from "@/server/auth/page";
import { discoverFeed } from "@/server/discover/service";

export const metadata: Metadata = { title: copy.metaTitle };
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { user } = await requireUserForPage();
  const initial = await discoverFeed(user, { sort: "active" });
  return (
    <PageShell variant="full" title={copy.title}>
      <DiscoverView initial={initial} />
    </PageShell>
  );
}
