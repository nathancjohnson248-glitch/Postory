import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/onboarding/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Start with a story.</h1>
      <p className="mb-8 mt-3 text-[15px] text-muted">Create your account. Your 3-day trial starts when you pick a plan.</p>
      <SignupForm />
      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
