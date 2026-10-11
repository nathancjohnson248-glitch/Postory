import { site } from "@/lib/site";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<p style="margin:28px 0 0"><a href="${cta.href}" style="display:inline-block;background:#0c0c0e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600;font-size:14px">${escape(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#fafaf8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0c0c0e">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="margin:0 0 28px;font-weight:700;font-size:18px;letter-spacing:-0.03em"><span style="color:#2f5bff">↗</span> Postory</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;letter-spacing:-0.02em">${escape(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#26262b">${body}</div>${button}
<p style="margin:40px 0 0;font-size:12px;color:#9c9ca4">${site.name} · ${site.domain}</p>
</div></body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 12px">${escape(text)}</p>`;

export const templates = {
  welcome: (input: { name: string | null }) => ({
    subject: "Welcome to Postory",
    text: `Hi${input.name ? ` ${input.name}` : ""}, your workspace is ready. Tell Postory what happened in your business and it will draft posts for every network, ready for your review: ${site.url}/app/create`,
    html: layout(
      `Welcome${input.name ? `, ${input.name}` : ""}.`,
      p("Your workspace is ready.") +
        p("Whenever something happens in your business — a launch, a milestone, a new hire — tell Postory. It drafts a post for each network and waits for your approval before anything goes out."),
      { label: "Create your first story", href: `${site.url}/app/create` },
    ),
  }),
  trialStarted: (input: { planName: string; trialEndsAt: string }) => ({
    subject: `Your Postory ${input.planName} trial has started`,
    text: `Your ${input.planName} trial runs until ${input.trialEndsAt}. Manage billing at ${site.url}/app/billing`,
    html: layout(
      `Your ${input.planName} trial has started.`,
      p(`It runs until ${input.trialEndsAt}. You can change or cancel your plan any time from Billing.`),
      { label: "Open billing", href: `${site.url}/app/billing` },
    ),
  }),
  publishFailed: (input: { network: string; reason: string; storyId: string }) => ({
    subject: `${input.network} post couldn't be published`,
    text: `${input.reason} Review it at ${site.url}/app/library/${input.storyId}`,
    html: layout(`Your ${input.network} post wasn't published.`, p(input.reason), {
      label: "Review the post",
      href: `${site.url}/app/library/${input.storyId}`,
    }),
  }),
  connectionIssue: (input: { network: string }) => ({
    subject: `Reconnect ${input.network} to keep posting`,
    text: `Postory can no longer post to ${input.network}. Reconnect it at ${site.url}/app/settings#accounts`,
    html: layout(
      `${input.network} needs to be reconnected.`,
      p(`The connection may have expired or been revoked. Scheduled posts for ${input.network} won't go out until it's reconnected.`),
      { label: `Reconnect ${input.network}`, href: `${site.url}/app/settings#accounts` },
    ),
  }),
};

export type EmailTemplate = keyof typeof templates;
export type TemplateInput<T extends EmailTemplate> = Parameters<(typeof templates)[T]>[0];
