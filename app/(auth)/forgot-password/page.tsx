import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/onboarding/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Reset your password.</h1>
      <p className="mb-8 mt-3 text-[15px] text-muted">We&apos;ll email you a code to choose a new one.</p>
      <ForgotPasswordForm />
      <p className="mt-8 text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
