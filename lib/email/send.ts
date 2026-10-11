import "server-only";

import { Resend } from "resend";
import { env, integrations } from "@/lib/env";
import { log } from "@/lib/log";
import { templates, type EmailTemplate, type TemplateInput } from "./templates";

let client: Resend | null = null;

/**
 * Send a transactional email. Email is never a blocker: when Resend isn't
 * configured the send is skipped and logged, and callers carry on.
 */
export async function sendEmail<T extends EmailTemplate>(to: string | null | undefined, template: T, input: TemplateInput<T>) {
  if (!to) return { sent: false as const, reason: "no_recipient" };
  if (!integrations.resend()) {
    log.info("email skipped (Resend not configured)", { operation: "email.send", provider: "resend", template });
    return { sent: false as const, reason: "not_configured" };
  }
  client ??= new Resend(env.resendApiKey());
  const { subject, html, text } = templates[template](input as never);
  try {
    const { error } = await client.emails.send({ from: env.resendFromEmail()!, to, subject, html, text });
    if (error) {
      log.warn("email rejected", { operation: "email.send", provider: "resend", template }, error);
      return { sent: false as const, reason: "rejected" };
    }
    return { sent: true as const };
  } catch (error) {
    log.warn("email failed", { operation: "email.send", provider: "resend", template }, error);
    return { sent: false as const, reason: "error" };
  }
}
