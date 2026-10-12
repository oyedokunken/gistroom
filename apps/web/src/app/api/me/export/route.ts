import { api } from "@/server/http";
import { buildExport } from "@/server/account/service";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** The person's own data as one JSON file, sent as a download. */
export const GET = api(async () => {
  const { user } = await requireUser();
  const data = await buildExport(user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gistroom-${user.username}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
