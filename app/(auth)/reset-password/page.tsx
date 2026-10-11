import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/onboarding/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Choose a new password.</h1>
      <p className="mb-8 mt-3 text-[15px] text-muted">You&apos;ll stay signed in afterwards.</p>
      <ResetPasswordForm />
    </>
  );
}
