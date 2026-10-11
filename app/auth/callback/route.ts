import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation/schemas";

/**
 * Lands OAuth (Google) and email links. Handles both the PKCE `code` flow and
 * the `token_hash` flow, then sends the user on. /app decides between the
 * workspace and onboarding from the database, so no query flag is trusted.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath.parse(url.searchParams.get("next") ?? "/app");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let failed = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      failed = true;
      log.warn("auth code exchange failed", { operation: "auth.callback" }, error);
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

  const target = url.clone();
  target.search = "";
  if (failed) {
    target.pathname = "/login";
    target.searchParams.set("error", url.searchParams.get("error_description") ? "provider" : "link");
  } else {
    target.pathname = type === "recovery" ? "/reset-password" : next;
  }
  return NextResponse.redirect(target);
}
