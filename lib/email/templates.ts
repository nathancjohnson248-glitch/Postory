import { site } from "@/lib/site";

/**
 * Postory's emails. Table-based with inline styles so they hold up in Gmail,
 * Apple Mail and Outlook; images are PNGs on postory.lol because most mail
 * clients won't show SVG.
 */

const ASSETS = `https://${site.domain}`;
const BLUE = "#2f5bff";
const INK = "#0c0c0e";
const SOFT = "#3a3a40";
const MUTED = "#6b6b73";
const LINE = "#ecebe7";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout({ preheader, body, footerNote }: { preheader: string; body: string; footerNote?: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Postory</title></head>
<body style="margin:0;padding:0;background:#f3f3f0;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f3f0;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:20px;">
<tr><td style="padding:28px 36px 22px 36px;border-bottom:1px solid ${LINE};">
<a href="${ASSETS}" style="text-decoration:none;"><img src="${ASSETS}/brand/email-logo.png" width="102" height="28" alt="Postory" style="display:block;border:0;height:28px;width:102px;"></a>
</td></tr>
<tr><td style="padding:32px 36px 36px 36px;font-family:${FONT};color:${SOFT};font-size:16px;line-height:1.65;">
${body}
</td></tr>
<tr><td style="padding:20px 36px 26px 36px;border-top:1px solid ${LINE};font-family:${FONT};font-size:12.5px;line-height:1.6;color:${MUTED};">
Postory · AI social media for founders who ship.<br>
<a href="${ASSETS}" style="color:${MUTED};text-decoration:underline;">${site.domain}</a>${footerNote ? `<br><span style="color:#9c9ca4;">${escape(footerNote)}</span>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const h1 = (text: string) => `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escape(text)}</h1>`;
const p = (text: string) => `<p style="margin:0 0 16px 0;">${escape(text)}</p>`;
const small = (text: string) => `<p style="margin:0;font-size:13.5px;line-height:1.6;color:${MUTED};">${escape(text)}</p>`;

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px 0;"><tr><td style="border-radius:12px;background:${BLUE};">
<a href="${href}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${escape(label)}</a>
</td></tr></table>`;
}

function codeBlock(code: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td align="center" style="padding:20px;border-radius:14px;background:#f3f3f0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:600;letter-spacing:0.22em;color:${INK};">${escape(code)}</td></tr></table>`;
}

function founderSignature() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>
<td valign="middle" style="padding-right:14px;"><img src="${ASSETS}/brand/mark.png" width="44" height="44" alt="" style="display:block;border:0;border-radius:12px;width:44px;height:44px;"></td>
<td valign="middle" style="font-family:${FONT};font-size:14px;line-height:1.45;">
<span style="font-weight:600;color:${INK};font-size:15px;">${escape(site.founder.name)}</span><br>
<span style="color:${MUTED};">Founder, Postory · </span><a href="${site.founder.xUrl}" style="color:${BLUE};text-decoration:none;font-weight:600;">${escape(site.founder.xHandle)}</a>
</td></tr></table>`;
}

/** The founder's public build log and direct lines, as a quiet card under the signature. */
function buildingInPublic() {
  const link = (href: string, label: string) => `<a href="${href}" style="color:${INK};text-decoration:none;font-weight:600;">${escape(label)}</a>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr><td style="padding:18px 20px;border-radius:14px;background:#f6f5f1;font-family:${FONT};font-size:14px;line-height:1.6;color:${SOFT};">
<span style="display:block;margin-bottom:6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">Building in public</span>
I share what shipped, what broke and what's next on <a href="${site.founder.xUrl}" style="color:${INK};font-weight:600;text-decoration:underline;">X</a> — the good weeks and the messy ones. Follow along, or just say hi.
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
<td style="padding-right:18px;font-size:13.5px;"><span style="color:${MUTED};">X&nbsp;</span>${link(site.founder.xUrl, site.founder.xHandle)}</td>
<td style="font-size:13.5px;"><span style="color:${MUTED};">Email&nbsp;</span>${link(`mailto:${site.founder.email}`, site.founder.email)}</td>
</tr></table>
</td></tr></table>`;
}

const firstName = (name: string | null) => (name ? name.trim().split(/\s+/)[0] : null);

export const templates = {
  deliveryTest: (input: { sentAt: string }) => ({
    subject: "Postory email test",
    text: `If you can read this, Postory can send email from its own address. Sent ${input.sentAt}.`,
    html: layout({ preheader: "Postory can send email from its own address.", body: h1("Email is working.") + p(`If you can read this, Postory can send email from its own address. Sent ${input.sentAt}.`) }),
  }),

  signupCode: (input: { code: string }) => ({
    subject: `${input.code} is your Postory code`,
    text: `Your Postory confirmation code is ${input.code}. Enter it on the sign-up page to confirm your email. It expires in an hour. If you didn't sign up for Postory, you can ignore this email.`,
    html: layout({
      preheader: `Your confirmation code is ${input.code}.`,
      footerNote: "You're receiving this because someone signed up to Postory with this address.",
      body:
        h1("Confirm your email") +
        p("Enter this code on the sign-up page to finish creating your Postory account.") +
        codeBlock(input.code) +
        small("It expires in an hour. If you didn't sign up for Postory, ignore this email — no account is created without the code."),
    }),
  }),

  loginCode: (input: { code: string }) => ({
    subject: `${input.code} is your Postory login code`,
    text: `Your Postory login code is ${input.code}. It expires in an hour. If you didn't try to log in, you can ignore this email — nobody can get in without the code.`,
    html: layout({
      preheader: `Your login code is ${input.code}.`,
      footerNote: "You're receiving this because someone asked to log in to Postory with this address.",
      body:
        h1("Your login code") +
        p("Enter this code on the log-in page to open Postory.") +
        codeBlock(input.code) +
        small("It expires in an hour. If you didn't try to log in, ignore this email — nobody can get in without the code."),
    }),
  }),

  resetCode: (input: { code: string }) => ({
    subject: `${input.code} is your Postory reset code`,
    text: `Your Postory password reset code is ${input.code}. It expires in an hour. If you didn't ask to reset your password, you can ignore this email.`,
    html: layout({
      preheader: `Your password reset code is ${input.code}.`,
      footerNote: "You're receiving this because a password reset was requested for this address.",
      body:
        h1("Reset your password") +
        p("Enter this code on the reset page, then choose a new password.") +
        codeBlock(input.code) +
        small("It expires in an hour. If you didn't ask to reset your password, ignore this email — your password stays the same."),
    }),
  }),

  welcome: (input: { name: string | null }) => {
    const first = firstName(input.name);
    const mail = site.founder.email;
    return {
      subject: "Welcome to Postory — a quick note from Nathan",
      text: [
        `Hi ${first ?? "there"},`,
        "",
        "Thanks for signing up — really glad you're here.",
        "",
        "I'm Nathan, and I built Postory for a simple reason: the businesses doing the most interesting work are often the ones posting the least. There's always something more urgent than rewriting the same update for five different apps.",
        "",
        "So Postory works the other way round. You tell it what happened — a launch, a new hire, a milestone, something you learned — and it shapes that one story into a post for each network you use. Nothing goes out until you've read it and said yes.",
        "",
        `Open Postory: ${site.url}/app`,
        "",
        `One thing I'd genuinely love to know: what made you try Postory, and what would make it worth keeping? Just reply to this email (or write to ${mail}) — I read every message myself.`,
        "",
        "Talk soon,",
        `${site.founder.name}`,
        `Founder, Postory`,
        "",
        `P.S. I'm building Postory in public — what shipped, what broke, and what's next. Follow along on X: ${site.founder.xUrl}`,
        "",
        `X: ${site.founder.xHandle} (${site.founder.xUrl})`,
        `Email: ${mail}`,
      ].join("\n"),
      html: layout({
        preheader: "Thanks for signing up — here's how Postory works, and how to reach me.",
        body:
          `<p style="margin:0 0 16px 0;color:${INK};">Hi ${escape(first ?? "there")},</p>` +
          `<p style="margin:0 0 20px 0;font-size:20px;line-height:1.4;font-weight:600;letter-spacing:-0.015em;color:${INK};">Thanks for signing up — really glad you're here.</p>` +
          p("I'm Nathan, and I built Postory for a simple reason: the businesses doing the most interesting work are often the ones posting the least. There's always something more urgent than rewriting the same update for five different apps.") +
          p("So Postory works the other way round. You tell it what happened — a launch, a new hire, a milestone, something you learned — and it shapes that one story into a post for each network you use. Nothing goes out until you've read it and said yes.") +
          button("Open Postory", `${site.url}/app`) +
          `<p style="margin:22px 0 0 0;">One thing I'd genuinely love to know: what made you try Postory, and what would make it worth keeping? <strong style="color:${INK};font-weight:600;">Just reply to this email</strong> (or write to <a href="mailto:${mail}" style="color:${BLUE};text-decoration:none;font-weight:600;">${escape(mail)}</a>) — I read every message myself.</p>` +
          `<p style="margin:22px 0 0 0;color:${INK};">Talk soon,</p>` +
          founderSignature() +
          buildingInPublic(),
      }),
    };
  },

  trialStarted: (input: { planName: string; trialEndsAt: string }) => ({
    subject: `Your Postory ${input.planName} trial has started`,
    text: `Your ${input.planName} trial runs until ${input.trialEndsAt}. You won't be charged before then, and you can cancel any time from Billing: ${site.url}/app/billing`,
    html: layout({
      preheader: `Your trial runs until ${input.trialEndsAt}.`,
      body:
        h1(`Your ${input.planName} trial has started.`) +
        p(`It runs until ${input.trialEndsAt}. You won't be charged before then, and you can change or cancel your plan any time from Billing.`) +
        button("Create your first story", `${site.url}/app/create`) +
        small(`Manage billing any time at ${site.domain}/app/billing.`),
    }),
  }),

  publishFailed: (input: { network: string; reason: string; storyId: string }) => ({
    subject: `Your ${input.network} post couldn't be published`,
    text: `${input.reason} Review it at ${site.url}/app/library/${input.storyId}`,
    html: layout({
      preheader: `${input.network} didn't accept the post.`,
      body: h1(`Your ${input.network} post wasn't published.`) + p(input.reason) + button("Review the post", `${site.url}/app/library/${input.storyId}`),
    }),
  }),

  connectionIssue: (input: { network: string }) => ({
    subject: `Reconnect ${input.network} to keep posting`,
    text: `Postory can no longer post to ${input.network}. Reconnect it at ${site.url}/app/settings#accounts`,
    html: layout({
      preheader: `Scheduled ${input.network} posts are on hold until it's reconnected.`,
      body:
        h1(`${input.network} needs to be reconnected.`) +
        p(`The connection may have expired or been revoked. Scheduled posts for ${input.network} won't go out until it's reconnected.`) +
        button(`Reconnect ${input.network}`, `${site.url}/app/settings#accounts`),
    }),
  }),
};

export type EmailTemplate = keyof typeof templates;
export type TemplateInput<T extends EmailTemplate> = Parameters<(typeof templates)[T]>[0];
