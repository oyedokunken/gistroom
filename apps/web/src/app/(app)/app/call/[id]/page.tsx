import type { Metadata } from "next";
import { CallDeepLink } from "@/components/call-window/call-deep-link";
import { callCopy } from "@/content/calls";

export const metadata: Metadata = { title: callCopy.audio };

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ answer?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <CallDeepLink callId={id} autoAnswer={query.answer === "1"} />;
}
