import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/onboarding/auth-forms";
import { authEmailMode } from "@/lib/auth/email-codes";
import { getAuthSettings } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  const auth = await getAuthSettings();
  const codes = authEmailMode() === "codes";
  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Start with a story.</h1>
      <p className="mb-8 mt-3 text-[15px] leading-relaxed text-muted">
        {codes ? "No password to remember — we'll email you a one-time code." : "Create your account. Your 3-day trial starts when you pick a plan."}
      </p>
      <SignupForm google={auth.google} codes={codes} />
      <ul className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <li>3-day trial</li>
        <li aria-hidden className="text-faint">
          ·
        </li>
        <li>Nothing posts without your OK</li>
        <li aria-hidden className="text-faint">
          ·
        </li>
        <li>Cancel anytime</li>
      </ul>
      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
