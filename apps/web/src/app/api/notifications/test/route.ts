import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { notify } from "@/server/notifications/service";

/** The "send me a test" button in Settings. Goes through the same path as a real notification. */
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  await notify({
    userId: user.id,
    type: "SYSTEM",
    payload: { title: "Test notification", body: "If you can read this, alerts reach you." },
  });
  return json({ ok: true });
});
