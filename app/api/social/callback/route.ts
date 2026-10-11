import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { getSessionUser } from "@/lib/auth/session";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { completeConnection } from "@/lib/social/service";
import { idSchema } from "@/lib/validation/schemas";

/**
 * The browser lands here after the network's consent screen (LetMePost sends
 * it back with `connected=` or `connect_error=`). The query string is treated
 * as a hint only: completeConnection() asks LetMePost which accounts actually
 * exist before anything is saved.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next") === "/onboarding" ? "/onboarding" : "/app/settings";
  const target = publicUrl(request, next);

  const user = await getSessionUser();
  if (!user) {
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  const attempt = idSchema.safeParse(url.searchParams.get("attempt"));
  if (!attempt.success) {
    target.searchParams.set("connect", "failed");
    target.searchParams.set("message", "That connection link wasn't valid. Start again.");
    return NextResponse.redirect(target);
  }

  try {
    const accounts = await completeConnection(user.id, attempt.data, url.searchParams.get("connect_error"));
    target.searchParams.set("connect", "success");
    if (accounts[0]) target.searchParams.set("platform", accounts[0].platform);
  } catch (error) {
    target.searchParams.set("connect", "failed");
    target.searchParams.set(
      "message",
      error instanceof UserFacingError ? error.message : "The connection couldn't be completed. Try again.",
    );
    if (!(error instanceof UserFacingError)) {
      log.error("connection callback failed", { operation: "social.callback", userId: user.id, provider: "letmepost" }, error);
    }
  }
  if (next === "/app/settings") target.hash = "accounts";
  return NextResponse.redirect(target);
}
