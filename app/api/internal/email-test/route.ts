import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { OWNER_EMAILS } from "@/lib/auth/admin";
import { env, integrations } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";

/**
 * Operational check: send one test email to the owner to confirm the
 * configured sender delivers. Off unless EMAIL_TEST_TOKEN is set, needs that
 * token, and can only ever email the owner's own address.
 */
export async function POST(request: NextRequest) {
  const expected = env.emailTestToken();
  const given = request.headers.get("x-postory-test-token") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!integrations.email()) return NextResponse.json({ ok: false, reason: "no_sender_configured" });
  const result = await sendEmail(OWNER_EMAILS[0], "deliveryTest", { sentAt: new Date().toUTCString() });
  return NextResponse.json({ ok: result.sent, provider: integrations.zoho() ? "zoho" : "smtp", ...("reason" in result ? { reason: result.reason } : {}) });
}
