import { identifySchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { identifyAccount } from "@/server/auth/auth-service";

/** Tells the sign in form what to do with an email: ask for a password, continue a sign up, or point to sign up. */
export const POST = api(async (request) => {
  const { email } = await parseJson(request, identifySchema);
  return json({ state: await identifyAccount(email, await clientIp()) });
});
