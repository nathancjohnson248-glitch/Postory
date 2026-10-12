import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isFirstSignIn, sendWelcomeEmail } from "@/lib/email/welcome";
import { redirectTo } from "@/lib/http/public-url";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation/schemas";

/**
 * Lands OAuth (Google) and email links. Handles both the PKCE `code` flow and
 * the `token_hash` flow, then sends the user on. /app decides between the
 * workspace and onboarding from the database, so no query flag is trusted.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath.parse(params.get("next") ?? "/app");
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  // Provider-side failure (e.g. the user cancelled Google consent).
  if (params.get("error")) {
    log.warn("auth provider returned an error", { operation: "auth.callback", error: params.get("error_description") ?? params.get("error") });
    return redirectTo(request, "/login", { error: "provider" });
  }

  const supabase = await createClient();
  let failed = false;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      failed = true;
      log.warn("auth code exchange failed", { operation: "auth.callback" }, error);
    } else if (data.user && isFirstSignIn(data.user)) {
      // A brand-new Google account.
      sendWelcomeEmail(data.user);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      failed = true;
      log.warn("auth otp verify failed", { operation: "auth.callback" }, error);
    }
  } else {
    failed = true;
  }

  if (failed) return redirectTo(request, "/login", { error: "link" });
  return redirectTo(request, type === "recovery" ? "/reset-password" : next);
}
