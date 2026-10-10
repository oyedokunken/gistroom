import { contactSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { enforce, policies } from "@/server/rate-limit";
import { sendTemplate } from "@/server/mail/send";

/** Contact form: 5 per hour per address (Section 20). A filled hidden field means a bot, which gets a quiet success. */
export const POST = api(async (request) => {
  const input = await parseJson(request, contactSchema);
  await enforce(policies.contact, await clientIp());
  if (input.website) return json({ ok: true });
  const inbox = process.env.SUPPORT_INBOX ?? "support@gistroom.ng";
  await sendTemplate("contact-inbox", inbox, {
    name: input.name,
    email: input.email,
    message: input.message,
  });
  await sendTemplate("contact-received", input.email, { name: input.name });
  return json({ ok: true });
});
