"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  requestEmailCode,
  requestPasswordReset,
  resendResetCode,
  resendVerificationCode,
  resetPassword,
  signIn,
  signInWithGoogle,
  signUp,
  verifySignupCode,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { CodeInput } from "./code-input";
import { GoogleLink, GoogleSubmit } from "./google-button";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {children}
    </Button>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-faint" role="separator">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function ErrorNotice({ state }: { state: AuthFormState }) {
  if (!state?.error) return null;
  return <Notice tone="danger" title={state.error} className="mb-5" />;
}

function GoogleChoice({ google, next }: { google: "privy" | "supabase" | null; next: string }) {
  if (!google) return null;
  return (
    <>
      {google === "privy" ? (
        <GoogleLink label="Continue with Google" next={next} />
      ) : (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <GoogleSubmit label="Continue with Google" />
        </form>
      )}
      <Divider />
    </>
  );
}

/** Email → code. The same form signs people up and logs them in. */
function EmailCodeForm({ label, cta }: { label: string; cta: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(requestEmailCode, undefined);
  return (
    <>
      <ErrorNotice state={state} />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label={label} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required autoFocus defaultValue={state?.email} aria-invalid={Boolean(state?.error) || undefined} />
        </Field>
        <Submit>
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </Submit>
      </form>
    </>
  );
}

function PasswordLoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, initialError ? { error: initialError } : undefined);
  return (
    <>
      <ErrorNotice state={state} />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} aria-invalid={Boolean(state?.error) || undefined} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-baseline justify-between">
              Password
              <Link href="/forgot-password" className="text-xs font-normal text-muted underline-offset-2 hover:text-ink hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          htmlFor="password"
        >
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Submit>Log in</Submit>
      </form>
    </>
  );
}

export function LoginForm({ next, initialError, google, codes }: { next: string; initialError?: string; google: "privy" | "supabase" | null; codes: boolean }) {
  const [withPassword, setWithPassword] = useState(!codes);
  return (
    <>
      <GoogleChoice google={google} next={next} />
      {initialError && !withPassword ? <Notice tone="danger" title={initialError} className="mb-5" /> : null}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={withPassword ? "password" : "code"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {withPassword ? <PasswordLoginForm next={next} initialError={codes ? undefined : initialError} /> : <EmailCodeForm label="Email" cta="Email me a code" />}
        </motion.div>
      </AnimatePresence>
      {codes ? (
        <button
          type="button"
          onClick={() => setWithPassword((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          {withPassword ? <Mail className="size-3.5" aria-hidden /> : <KeyRound className="size-3.5" aria-hidden />}
          {withPassword ? "Email me a code instead" : "Use my password instead"}
        </button>
      ) : null}
    </>
  );
}

export function SignupForm({ google, codes }: { google: "privy" | "supabase" | null; codes: boolean }) {
  if (codes) {
    return (
      <>
        <GoogleChoice google={google} next="/onboarding" />
        <EmailCodeForm label="Email address" cta="Create account" />
      </>
    );
  }
  return <PasswordSignupForm google={google} />;
}

function PasswordSignupForm({ google }: { google: "privy" | "supabase" | null }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, undefined);
  return (
    <>
      <GoogleChoice google={google} next="/onboarding" />
      <ErrorNotice state={state} />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Submit>Create account</Submit>
      </form>
    </>
  );
}

/** Counts down before another code may be requested. Remount (key) to restart. */
function ResendButton({ seconds, pending }: { seconds: number; pending: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  const waiting = left > 0;
  return (
    <button
      type="submit"
      disabled={waiting || pending}
      className="text-sm font-medium text-ink underline-offset-4 transition-colors hover:underline disabled:cursor-default disabled:text-faint disabled:no-underline"
    >
      {pending ? "Sending…" : waiting ? `Send a new code in ${left}s` : "Send a new code"}
    </button>
  );
}

function ResendCode({ action: resend, initialWait }: { action: () => Promise<AuthFormState>; initialWait: number }) {
  const [state, action, pending] = useActionState<AuthFormState>(resend, undefined);
  const wait = state?.retryAfter ?? (state ? 0 : initialWait);
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false} mode="wait">
        {state?.notice || state?.error ? (
          <motion.p
            key={state.attempt}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={state.error ? "text-sm text-danger" : "text-sm text-success"}
            role="status"
          >
            {state.notice ?? state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <form action={action}>
        <ResendButton key={state?.attempt ?? 0} seconds={wait} pending={pending} />
      </form>
    </div>
  );
}

export function VerifyEmailForm({ codeLength }: { codeLength: number }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(verifySignupCode, undefined);
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <CodeInput key={state?.attempt ?? 0} length={codeLength} invalid={Boolean(state?.error)} disabled={pending} />
        <AnimatePresence initial={false}>
          {state?.error ? (
            <motion.p key={state.attempt} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-danger" role="alert">
              {state.error}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <Submit>Confirm email</Submit>
      </form>
      <ResendCode action={resendVerificationCode} initialWait={45} />
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorNotice state={state} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} />
      </Field>
      <Submit>Email me a code</Submit>
    </form>
  );
}

export function ResetPasswordForm({ codeLength = null }: { codeLength?: number | null }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, undefined);
  const needsCode = codeLength !== null;
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5" noValidate>
        <ErrorNotice state={state} />
        {needsCode ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink-soft">Code from the email</span>
            <CodeInput key={state?.attempt ?? 0} length={codeLength} invalid={Boolean(state?.attempt)} disabled={pending} autoSubmit={false} />
          </div>
        ) : null}
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Submit>Save new password</Submit>
      </form>
      {needsCode ? <ResendCode action={resendResetCode} initialWait={45} /> : null}
    </div>
  );
}
