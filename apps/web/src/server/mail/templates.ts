import { z } from "zod";
import { LIMITS } from "@gistroom/shared";
import { codeBlock, heading, paragraph, renderLayout, escapeHtml } from "./layout";

export interface RenderContext {
  appUrl: string;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

export interface Template<S extends z.ZodTypeAny> {
  id: string;
  schema: S;
  /** Sample props used by the preview script and the template tests. */
  sample: z.infer<S>;
  render: (props: z.infer<S>, ctx: RenderContext) => Rendered;
}

function define<S extends z.ZodTypeAny>(t: Template<S>): Template<S> {
  return t;
}

const otpProps = z.object({ code: z.string().regex(/^\d{6}$/) });

// Security emails use plain language, no slang (Section 18).
const SUBJECT = "Your Gistroom code";

function otpTemplate(id: string, headline: string, intro: string) {
  return define({
    id,
    schema: otpProps,
    sample: { code: "042917" },
    render: ({ code }, { appUrl }) => {
      const minutes = LIMITS.OTP_TTL_MIN;
      const preheader = `Your code is ${code}. It works for ${minutes} minutes.`;
      const bodyHtml = [
        heading(headline),
        paragraph(escapeHtml(intro)),
        codeBlock(code),
        paragraph(
          `This code works for ${minutes} minutes. Never share it with anyone, including people who say they work for Gistroom.`,
        ),
        paragraph(
          "If you did not ask for this code, you can ignore this email. Nobody can sign in without it.",
        ),
      ].join("\n");
      const text = [
        headline,
        "",
        intro,
        "",
        `Your code: ${code}`,
        "",
        `This code works for ${minutes} minutes. Never share it with anyone, including people who say they work for Gistroom.`,
        "",
        "If you did not ask for this code, you can ignore this email. Nobody can sign in without it.",
      ].join("\n");
      return {
        subject: SUBJECT,
        html: renderLayout({ appUrl, title: SUBJECT, preheader, bodyHtml }),
        text,
      };
    },
  });
}

export const templates = {
  "verify-otp": otpTemplate(
    "verify-otp",
    "Confirm your email",
    "Use this code to confirm your email address and finish creating your Gistroom account.",
  ),
  "login-otp": otpTemplate(
    "login-otp",
    "Sign in to Gistroom",
    "Use this code to sign in to your Gistroom account.",
  ),
} as const;

export type TemplateId = keyof typeof templates;
