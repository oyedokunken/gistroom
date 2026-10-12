import { api } from "@/server/http";
import { buildExport } from "@/server/account/service";
import { buildReportPdf } from "@/server/account/report";
import { requireRecentAuth, requireUser } from "@/server/auth/session";
import { notify } from "@/server/notifications/service";
import { dataReport } from "@/content/account-report";

export const dynamic = "force-dynamic";

/** The person's own data as a PDF, sent as a download. A notice in their list says it was downloaded. */
export const GET = api(async () => {
  const ctx = await requireUser();
  const { user } = ctx;
  // A copy of everything someone gave Gistroom is a sensitive download. Accounts with a password prove it again first.
  if (user.passwordHash) requireRecentAuth(ctx);
  const data = await buildExport(user);
  const pdf = buildReportPdf(data, user.timezone ?? "Africa/Lagos");
  void notify({
    userId: user.id,
    type: "SYSTEM",
    payload: { title: dataReport.notifyTitle, body: dataReport.notifyBody },
  }).catch(() => null);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${dataReport.fileName(user.username)}"`,
      "Cache-Control": "no-store",
    },
  });
});
