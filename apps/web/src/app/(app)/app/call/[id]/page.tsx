import type { Metadata } from "next";
import { CallScreen } from "@/components/call/call-screen";
import { callCopy } from "@/content/calls";
import { getSessionContext } from "@/server/auth/session";

export const metadata: Metadata = { title: callCopy.audio };

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ answer?: string }>;
}) {
  const [{ id }, query, ctx] = await Promise.all([params, searchParams, getSessionContext()]);
  return (
    <CallScreen
      callId={id}
      autoAnswer={query.answer === "1"}
      dataSaver={ctx?.user.dataSaver ?? true}
    />
  );
}
