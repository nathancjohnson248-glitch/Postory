"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { requestPasswordReset, signIn, signInWithGoogle, signUp, updatePassword, type AuthFormState } from "@/app/(auth)/actions";
import { GoogleSubmit } from "./google-button";

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

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, initialError ? { error: initialError } : undefined);
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleSubmit label="Continue with Google" />
      </form>
      <Divider />
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

export function SignupForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, undefined);
  if (state?.notice) {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Check your email</h2>
        <p className="text-[15px] leading-relaxed text-muted">{state.notice}</p>
      </div>
    );
  }
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value="/onboarding" />
        <GoogleSubmit label="Sign up with Google" />
      </form>
      <Divider />
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

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, undefined);
  if (state?.notice) return <Notice tone="success" title="Check your email">{state.notice}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorNotice state={state} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Submit>Send reset link</Submit>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorNotice state={state} />
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Submit>Update password</Submit>
    </form>
  );
}
