"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { completeOnboarding, goToStep, saveBusiness, saveVoice, type StepFormState } from "@/app/onboarding/actions";
import { BUSINESS_TYPES, VOICE_PRESETS } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

function ContinueButton({ children = "Continue" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending}>
      {children}
      {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
    </Button>
  );
}

export function BackButton({ to }: { to: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="lg" loading={pending} onClick={() => start(() => goToStep(to))} icon={!pending ? <ArrowLeft className="size-4" aria-hidden /> : undefined}>
      Back
    </Button>
  );
}

export function NextStepButton({ to, label = "Continue", variant = "primary" }: { to: string; label?: string; variant?: "primary" | "ghost" | "secondary" }) {
  const [pending, start] = useTransition();
  return (
    <Button size="lg" variant={variant} loading={pending} onClick={() => start(() => goToStep(to))}>
      {label}
      {!pending && variant === "primary" ? <ArrowRight className="size-4" aria-hidden /> : null}
    </Button>
  );
}

export function BusinessStep({
  defaults,
}: {
  defaults: { businessName: string; businessDescription: string; businessType: string; websiteUrl: string };
}) {
  const [state, submit] = useActionState<StepFormState, FormData>(saveBusiness, undefined);
  // The browser's timezone is read at submit time and saved to the profile.
  const action = (formData: FormData) => {
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    return submit(formData);
  };
  const e = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.error ? <Notice tone="danger" title={state.error} /> : null}
      <Field label="What's your business called?" htmlFor="businessName" error={e.businessName}>
        <Input id="businessName" name="businessName" defaultValue={defaults.businessName} placeholder="Fernwood" required autoFocus aria-invalid={Boolean(e.businessName) || undefined} />
      </Field>
      <Field label="What do you do?" htmlFor="businessDescription" error={e.businessDescription} hint="A sentence or two, in your own words. Postory only uses what you tell it.">
        <Textarea
          id="businessDescription"
          name="businessDescription"
          defaultValue={defaults.businessDescription}
          placeholder="We make a calm habit tracker for iPhone. Small team, launched this year."
          rows={3}
          required
          aria-invalid={Boolean(e.businessDescription) || undefined}
        />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Business type" htmlFor="businessType" error={e.businessType}>
          <Select id="businessType" name="businessType" defaultValue={defaults.businessType || ""} required aria-invalid={Boolean(e.businessType) || undefined}>
            <option value="" disabled>
              Choose one
            </option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Website" htmlFor="websiteUrl" optional error={e.websiteUrl}>
          <Input id="websiteUrl" name="websiteUrl" defaultValue={defaults.websiteUrl} placeholder="fernwood.app" inputMode="url" aria-invalid={Boolean(e.websiteUrl) || undefined} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <ContinueButton />
      </div>
    </form>
  );
}

export function VoiceStep({ defaults }: { defaults: { presets: string[]; notes: string } }) {
  const [state, action] = useActionState<StepFormState, FormData>(saveVoice, undefined);
  const [selected, setSelected] = useState<string[]>(defaults.presets);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.error ? <Notice tone="danger" title={state.error} /> : null}
      <fieldset>
        <legend className="mb-3 text-[13px] font-medium text-ink-soft">Pick any that fit</legend>
        <div className="flex flex-wrap gap-2">
          {VOICE_PRESETS.map((preset) => {
            const on = selected.includes(preset);
            return (
              <label
                key={preset}
                className={cn(
                  "cursor-pointer select-none rounded-full px-4 py-2 text-sm font-medium ring-1 transition-all duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500",
                  on ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line hover:ring-line-strong",
                )}
              >
                <input
                  type="checkbox"
                  name="presets"
                  value={preset}
                  checked={on}
                  onChange={() => setSelected((s) => (on ? s.filter((p) => p !== preset) : [...s, preset]))}
                  className="sr-only"
                />
                {preset}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="In your own words" htmlFor="notes" optional hint="e.g. “Short sentences. Never say ‘excited to announce’. Lowercase on X is fine.”">
        <Textarea id="notes" name="notes" defaultValue={defaults.notes} rows={3} maxLength={600} />
      </Field>
      <div className="mt-2 flex items-center justify-between">
        <BackButton to="social" />
        <ContinueButton>{selected.length ? "Continue" : "Skip for now"}</ContinueButton>
      </div>
    </form>
  );
}

export function FinishButton() {
  const [pending, start] = useTransition();
  return (
    <Button size="lg" variant="accent" loading={pending} onClick={() => start(() => completeOnboarding())}>
      Open Postory
      {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
    </Button>
  );
}
