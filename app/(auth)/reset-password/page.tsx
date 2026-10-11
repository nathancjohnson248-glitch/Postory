import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/onboarding/auth-forms";
import { getPendingEmail } from "@/lib/auth/pending";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const [user, pending] = await Promise.all([getSessionUser(), getPendingEmail("reset")]);
  if (!user && !pending) redirect("/forgot-password");
  const needsCode = !user && pending;

  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Choose a new password.</h1>
      <p className="mb-8 mt-3 text-[15px] leading-relaxed text-muted text-pretty">
        {needsCode ? (
          <>
            If <span className="font-medium text-ink">{pending.email}</span> has a Postory account, we&apos;ve emailed it a code. Enter it with your new password —
            you&apos;ll stay signed in afterwards.
          </>
        ) : (
          "You'll stay signed in afterwards."
        )}
      </p>
      <ResetPasswordForm codeLength={needsCode ? pending.codeLength : null} />
      {needsCode ? (
        <p className="mt-10 text-sm text-muted">
          Wrong address?{" "}
          <Link href="/forgot-password" className="font-medium text-ink underline-offset-2 hover:underline">
            Start again
          </Link>
        </p>
      ) : null}
    </>
  );
}
