import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { env, integrations } from "@/lib/env";
import { log } from "@/lib/log";
import { templates, type EmailTemplate, type TemplateInput } from "./templates";
import { sendViaZoho } from "./zoho";

let smtp: Transporter | null = null;

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
 * Send an email from Postory's own send-only address — through Zoho Mail's
 * API, or an SMTP mailbox when Zoho isn't configured. Replies aren't read;
 * every template says where to reach a person instead.
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

  if (integrations.zoho()) {
    try {
      const messageId = await sendViaZoho({ to, subject, html });
      log.info("email sent", { operation: "email.send", provider: "zoho", template, response: messageId ?? "" });
      return { sent: true as const };
    } catch (error) {
      log.warn("email failed", { operation: "email.send", provider: "zoho", template }, error);
      return { sent: false as const, reason: "error" };
    }
  }

  try {
    const info = await smtpTransport().sendMail({ from: env.smtpFrom(), to, subject, html, text });
    log.info("email sent", { operation: "email.send", provider: "smtp", template, response: String(info.response).slice(0, 120) });
    return { sent: true as const };
  } catch (error) {
    log.warn("email failed", { operation: "email.send", provider: "smtp", template }, error);
    return { sent: false as const, reason: "error" };
  }
}
