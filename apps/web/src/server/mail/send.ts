import type { z } from "zod";
import { templates, type TemplateId } from "./templates";
import { deliver, mailConfigFromEnv, type MailConfig } from "./transport";

export type PropsFor<T extends TemplateId> = z.infer<(typeof templates)[T]["schema"]>;

/**
 * Validate props, render and deliver. OTP and security mail is never queued for later:
 * a failure throws so the caller can tell the person plainly (Section 19).
 */
export async function sendTemplate<T extends TemplateId>(
  id: T,
  to: string,
  props: PropsFor<T>,
  options: { appUrl?: string; config?: MailConfig } = {},
): Promise<void> {
  const template = templates[id];
  const parsed = template.schema.parse(props);
  const appUrl = options.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const rendered = template.render(parsed, { appUrl });
  await deliver({ to, ...rendered }, options.config ?? mailConfigFromEnv(process.env));
}
