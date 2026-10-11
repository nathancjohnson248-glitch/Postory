import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { getSessionUser } from "@/lib/auth/session";
import { reconcileCheckout } from "@/lib/billing/service";
import { sendEmail } from "@/lib/email/send";
import { PLANS } from "@/lib/billing/plans";
import { idSchema } from "@/lib/validation/schemas";

/**
 * Return URL for HandyPay checkout. Nothing about the redirect itself is
 * trusted: we read the checkout outcome from HandyPay's API and only then
 * update the subscription.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const requested = url.searchParams.get("next");
  const next = requested === "/onboarding" || requested === "/start" ? requested : "/app/billing";
  const target = publicUrl(request, next);

  const user = await getSessionUser();
  if (!user) {
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  const event = idSchema.safeParse(url.searchParams.get("event"));
  if (!event.success) return NextResponse.redirect(target);

  try {
    const result = await reconcileCheckout(user.id, event.data);
    target.searchParams.set("billing", result.status === "completed" ? "confirmed" : result.status === "expired" ? "expired" : "pending");
    // Trial confirmed from the start page: straight into the app.
    if (next === "/start" && result.status === "completed") {
      target.pathname = "/app";
      target.search = "";
      target.searchParams.set("welcome", "1");
    }
    if (result.status === "completed" && result.subscription?.status === "trialing" && result.subscription.plan) {
      await sendEmail(user.email, "trialStarted", {
        planName: PLANS[result.subscription.plan].name,
        trialEndsAt: result.subscription.trialEndsAt?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? "the end of your trial",
      });
    }
  } catch {
    target.searchParams.set("billing", "error");
  }
  return NextResponse.redirect(target);
}
