import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { publicUrl } from "@/lib/http/public-url";
import { log } from "@/lib/log";
import { completeConnection } from "@/lib/social/service";
import { idSchema } from "@/lib/validation/schemas";

/**
 * Where the browser lands after a network's consent screen (via Zernio).
 * Nothing in the query string is trusted beyond "which attempt" and whether
 * the user cancelled: the attempt must belong to the signed-in user, and the
 * accounts saved are the ones Zernio reports on that user's own profile.
 * A failure is stored on the attempt, and the Connections list shows it.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const target = publicUrl(request, url.searchParams.get("from") === "onboarding" ? "/onboarding" : "/app/connections");

  const user = await getSessionUser();
  if (!user) {
    target.pathname = "/login";
    target.search = "";
    return NextResponse.redirect(target);
  }

  const attempt = idSchema.safeParse(url.searchParams.get("attempt"));
  if (!attempt.success) return NextResponse.redirect(target);

  try {
    const { saved, skipped } = await completeConnection(user.id, attempt.data, { error: url.searchParams.get("error") });
    target.searchParams.set("connect", "success");
    if (saved[0]) target.searchParams.set("platform", saved[0].platform);
    if (skipped) target.searchParams.set("over_limit", String(skipped));
  } catch (error) {
    log.warn("connection callback failed", { operation: "social.callback", userId: user.id, resourceId: attempt.data }, error);
    target.searchParams.set("connect", "failed");
  }
  revalidatePath("/app", "layout");
  revalidatePath("/onboarding");
  return NextResponse.redirect(target);
}
