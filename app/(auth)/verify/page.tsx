import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/onboarding/auth-forms";
import { getPendingEmail } from "@/lib/auth/pending";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const [pending, { reason }] = await Promise.all([getPendingEmail("verify"), searchParams]);
  if (!pending) redirect("/signup");

  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Check your email.</h1>
      <p className="mb-8 mt-3 text-[15px] leading-relaxed text-muted text-pretty">
        {reason === "unconfirmed" ? "Your email isn't confirmed yet, so we sent a fresh code to " : "We sent a code to "}
        <span className="font-medium text-ink">{pending.email}</span>. Enter it below to {reason === "unconfirmed" ? "finish logging in" : "confirm your account"}.
      </p>
      <VerifyEmailForm codeLength={pending.codeLength} />
      <p className="mt-10 text-sm text-muted">
        Wrong address?{" "}
        <Link href="/signup" className="font-medium text-ink underline-offset-2 hover:underline">
          Start again
        </Link>
        <span className="mx-2 text-faint">·</span>
        Can&apos;t find it? Check spam or promotions.
      </p>
    </>
  );
}
