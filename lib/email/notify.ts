import "server-only";

import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send";
import type { EmailTemplate, TemplateInput } from "./templates";

/**
 * Email a Postory user about something that needs them (a failed publish, a
 * broken connection). Never throws and never blocks the caller: alerts are
 * best-effort, and the app shows the same state in the UI regardless.
 */
export function notifyUser<T extends EmailTemplate>(userId: string, template: T, input: TemplateInput<T>) {
  void (async () => {
    try {
      const { data } = await createAdminClient().from("profiles").select("email").eq("id", userId).maybeSingle();
      await sendEmail(data?.email, template, input);
    } catch (error) {
      log.warn("user notification failed", { operation: "email.notify", userId, template }, error);
    }
  })();
}
