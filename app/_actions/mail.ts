"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminRole } from "@/lib/auth/admin";
import { integrations } from "@/lib/env";
import { addMailForward, getMessageContent, markRead, replyToMessage, sendViaZoho, ZohoScopeError } from "@/lib/email/zoho";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

/** The postory.lol mailbox is the owner's alone. */
async function assertOwner(user: Parameters<typeof getAdminRole>[0]) {
  if ((await getAdminRole(user)) !== "owner") throw new UserFacingError("forbidden", "Only the owner can use the mailbox.");
  if (!integrations.zoho()) throw new UserFacingError("not_configured", "The mailbox isn't connected.");
}

const zohoId = z.string().regex(/^\d{1,30}$/);
const addresses = z
  .string()
  .trim()
  .min(3, "Add a recipient.")
  .max(1000)
  .refine((v) => v.split(",").every((a) => z.email().safeParse(a.trim()).success), "Enter valid email addresses, separated by commas.");
const ComposeSchema = z.object({
  to: addresses,
  subject: z.string().trim().min(1, "Add a subject.").max(300),
  body: z.string().trim().min(1, "Write a message.").max(20_000),
});

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const toHtml = (text: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0c0c0e">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;

function rethrowScope(error: unknown): never {
  if (error instanceof ZohoScopeError) throw new UserFacingError("mail_scope", error.message);
  throw error;
}

export async function openMail(folderId: string, messageId: string) {
  return runAction("mail.open", async (user) => {
    await assertOwner(user);
    const f = zohoId.parse(folderId);
    const m = zohoId.parse(messageId);
    try {
      const html = await getMessageContent(f, m);
      await markRead(m).catch(() => undefined);
      return { html };
    } catch (error) {
      rethrowScope(error);
    }
  });
}

export async function sendMail(input: { to: string; subject: string; body: string }) {
  return runAction("mail.send", async (user) => {
    await assertOwner(user);
    const parsed = ComposeSchema.safeParse(input);
    if (!parsed.success) throw new UserFacingError("invalid", parsed.error.issues[0]?.message ?? "Check the message.");
    try {
      await sendViaZoho({ to: parsed.data.to, subject: parsed.data.subject, html: toHtml(parsed.data.body) });
    } catch (error) {
      rethrowScope(error);
    }
    revalidatePath("/app/admin/mail");
    return null;
  });
}

export async function replyMail(input: { messageId: string; to: string; subject: string; body: string }) {
  return runAction("mail.reply", async (user) => {
    await assertOwner(user);
    const id = zohoId.parse(input.messageId);
    const parsed = ComposeSchema.safeParse(input);
    if (!parsed.success) throw new UserFacingError("invalid", parsed.error.issues[0]?.message ?? "Check the message.");
    try {
      await replyToMessage(id, { to: parsed.data.to, subject: parsed.data.subject, html: toHtml(parsed.data.body) });
    } catch (error) {
      rethrowScope(error);
    }
    revalidatePath("/app/admin/mail");
    return null;
  });
}

/** Forward the mailbox to the owner's own sign-in address — never anywhere else. */
export async function forwardMailboxToMe() {
  return runAction("mail.forward", async (user) => {
    await assertOwner(user);
    if (!user.email) throw new UserFacingError("no_email", "Your account has no email address.");
    try {
      await addMailForward(user.email);
    } catch (error) {
      if (error instanceof ZohoScopeError) {
        throw new UserFacingError("mail_scope", "Zoho needs one more permission (ZohoMail.accounts.UPDATE). Add it to the Zoho connection, or turn on forwarding in Zoho Mail → Settings → Mail Forwarding.");
      }
      throw error;
    }
    return { to: user.email };
  });
}
