import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/onboarding/auth-forms";
import { getAuthSettings } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Log in or request a new link.",
  oauth: "Google sign-in couldn't start. Try again.",
  provider: "Google didn't complete the sign-in. Try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, auth] = await Promise.all([searchParams, getAuthSettings()]);
  return (
    <>
      <h1 className="font-display text-[44px] leading-none tracking-[-0.02em]">Welcome back.</h1>
      <p className="mb-8 mt-3 text-[15px] text-muted">Log in to see what&apos;s moving.</p>
      <LoginForm google={auth.google} next={safeNextPath.parse(next ?? "/app")} initialError={error ? ERRORS[error] ?? ERRORS.link : undefined} />
      <p className="mt-8 text-sm text-muted">
        New to Postory?{" "}
        <Link href="/signup" className="font-medium text-ink underline-offset-2 hover:underline">
          Start your 3-day trial
        </Link>
      </p>
    </>
  );
}
