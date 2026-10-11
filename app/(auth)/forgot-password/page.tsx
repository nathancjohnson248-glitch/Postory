import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ForgotPasswordForm } from "@/components/onboarding/auth-forms";
import { Notice } from "@/components/ui/notice";
import { authEmailMode } from "@/lib/auth/email-codes";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  // Read the sender configuration per request, not at build time.
  await connection();
  const available = authEmailMode() !== "instant";
  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Reset your password.</h1>
      <p className="mb-8 mt-3 text-[15px] text-muted">
        {available ? "We'll email you a code to choose a new one." : "Locked out? We'll get you back in."}
      </p>
      {available ? (
        <ForgotPasswordForm />
      ) : (
        <Notice tone="info" title="Password reset by email is still being set up">
          Email{" "}
          <a href={`mailto:${site.founder.email}?subject=Postory%20password%20reset`} className="font-medium underline underline-offset-2">
            {site.founder.email}
          </a>{" "}
          from the address on your account and we&apos;ll reset it for you.
        </Notice>
      )}
      <p className="mt-8 text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
