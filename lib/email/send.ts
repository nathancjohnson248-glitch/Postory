import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env, integrations } from "@/lib/env";
import { log } from "@/lib/log";
import { templates, type EmailTemplate, type TemplateInput } from "./templates";

let smtp: Transporter | null = null;
let resend: Resend | null = null;

function smtpTransport() {
  smtp ??= nodemailer.createTransport({
    host: env.smtpHost(),
    port: env.smtpPort(),
    secure: env.smtpPort() === 465,
    auth: { user: env.smtpUser(), pass: env.smtpPassword() },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return smtp;
}

/**
 * Send a transactional email from Postory's own address — through the
 * configured SMTP mailbox (e.g. Zoho Mail), or Resend if that's what's set.
 * Email is never a blocker: when no sender is configured the send is skipped
 * and logged, and callers carry on.
 */
export async function sendEmail<T extends EmailTemplate>(to: string | null | undefined, template: T, input: TemplateInput<T>) {
  if (!to) return { sent: false as const, reason: "no_recipient" };
  if (!integrations.email()) {
    log.info("email skipped (no sender configured)", { operation: "email.send", template });
    return { sent: false as const, reason: "not_configured" };
  }
  const { subject, html, text } = templates[template](input as never);

  if (integrations.smtp()) {
    try {
      await smtpTransport().sendMail({ from: env.smtpFrom(), to, subject, html, text });
      return { sent: true as const };
    } catch (error) {
      log.warn("email failed", { operation: "email.send", provider: "smtp", template }, error);
      return { sent: false as const, reason: "error" };
    }
  }

  resend ??= new Resend(env.resendApiKey());
  try {
    const { error } = await resend.emails.send({ from: env.resendFromEmail()!, to, subject, html, text });
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
