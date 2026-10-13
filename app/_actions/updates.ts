"use server";

import { z } from "zod";
import { getAdminRole } from "@/lib/auth/admin";
import { integrations } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAction } from "./_run";

const UpdateSchema = z
  .object({
    subject: z.string().trim().min(3, "Add a subject.").max(150),
    headline: z.string().trim().min(3, "Add a headline.").max(150),
    body: z.string().trim().min(20, "Write a few sentences.").max(8000),
    ctaLabel: z.string().trim().max(40).optional().default(""),
    ctaUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "The button link must start with https://." })]).optional().default(""),
  })
  .refine((v) => Boolean(v.ctaLabel) === Boolean(v.ctaUrl), { message: "A button needs both a label and a link." });

export type ProductUpdateInput = z.input<typeof UpdateSchema>;

/**
 * Owner only. "test" sends the update to the owner's own address; "all" sends
 * it to every user who hasn't turned product updates off. Transactional email
 * (codes, failures) never goes through here.
 */
export async function sendProductUpdate(input: ProductUpdateInput & { mode: "test" | "all" }) {
  return runAction("updates.send", async (user) => {
    if ((await getAdminRole(user)) !== "owner") throw new UserFacingError("forbidden", "Only the owner can send product updates.");
    if (!integrations.email()) throw new UserFacingError("not_configured", "No email sender is configured on this deployment.");
    const mode = z.enum(["test", "all"]).parse(input.mode);
    const parsed = UpdateSchema.safeParse(input);
    if (!parsed.success) throw new UserFacingError("invalid", parsed.error.issues[0]?.message ?? "Check the update.");
    const { ctaLabel, ctaUrl, ...rest } = parsed.data;
    const content = { ...rest, ...(ctaLabel && ctaUrl ? { ctaLabel, ctaUrl } : {}) };

    if (mode === "test") {
      const result = await sendEmail(user.email, "productUpdate", content);
      if (!result.sent) throw new UserFacingError("send_failed", "The test email didn't send. Check the email sender in Railway.");
      return { sent: 1, failed: 0, to: user.email };
    }

    const admin = createAdminClient();
    const recipients: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("profiles").select("email").eq("product_updates", true).not("email", "is", null).range(from, from + 999);
      if (error) throw error;
      recipients.push(...(data ?? []).map((r) => r.email!).filter(Boolean));
      if (!data || data.length < 1000) break;
    }
    const unique = [...new Set(recipients.map((e) => e.toLowerCase()))];

    let sent = 0;
    let failed = 0;
    // A few at a time: fast enough for a launch-sized list, gentle on the mail API.
    for (let i = 0; i < unique.length; i += 5) {
      const batch = await Promise.all(unique.slice(i, i + 5).map((to) => sendEmail(to, "productUpdate", content)));
      for (const r of batch) r.sent ? sent++ : failed++;
    }
    log.info("product update sent", { operation: "updates.send", userId: user.id, response: `${sent} sent, ${failed} failed` });
    return { sent, failed, to: null };
  });
}
