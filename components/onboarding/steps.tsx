"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Layers, PenLine, Rocket, ShoppingBag, Sparkles, Store, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { completeOnboarding, goToStep, saveAbout, saveBusiness, saveVoice, type StepFormState } from "@/app/onboarding/actions";
import { BUSINESS_TYPE_DETAILS } from "@/lib/onboarding/business-types";
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

const TYPE_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  pen: PenLine,
  bag: ShoppingBag,
  store: Store,
  layers: Layers,
  briefcase: BriefcaseBusiness,
  sparkle: Sparkles,
};

export function AboutStep({ defaults }: { defaults: { name: string; businessType: string } }) {
  const [state, action] = useActionState<StepFormState, FormData>(saveAbout, undefined);
  const [type, setType] = useState(defaults.businessType);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      {state?.error ? <Notice tone="danger" title={state.error} /> : null}
      <div className="mx-auto w-full max-w-sm">
        <Field label="What should Postory call you?" htmlFor="name" error={e.name}>
          <Input id="name" name="name" defaultValue={defaults.name} placeholder="Your first name" autoComplete="given-name" required aria-invalid={Boolean(e.name) || undefined} />
        </Field>
      </div>

      <fieldset>
        <legend className="sr-only">What are you building?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BUSINESS_TYPES.map((t, i) => {
            const detail = BUSINESS_TYPE_DETAILS[t];
            const Icon = TYPE_ICONS[detail.icon] ?? Sparkles;
            const on = type === t;
            return (
              <motion.label
                key={t}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-3 rounded-3xl bg-surface p-5 text-left ring-1 transition-[box-shadow,transform,background-color] duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500 sm:p-6",
                  on ? "bg-blue-50/50 shadow-soft ring-2 ring-blue-500" : "shadow-[0_1px_2px_rgba(12,12,14,0.04)] ring-line hover:-translate-y-0.5 hover:shadow-soft hover:ring-line-strong",
                  t === "Something else" && "sm:col-span-2",
                )}
              >
                <input type="radio" name="businessType" value={t} checked={on} onChange={() => setType(t)} className="sr-only" />
                <div className="flex items-start justify-between gap-3">
                  <span className={cn("grid size-11 place-items-center rounded-2xl transition-colors", on ? "bg-blue-600 text-white" : "bg-wash text-ink-soft group-hover:text-ink")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className={cn("grid size-6 place-items-center rounded-full ring-1 transition-all", on ? "bg-blue-600 text-white ring-blue-600" : "ring-line-strong")}>
                    {on ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>
                </div>
                <div>
                  <p className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{t}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{detail.blurb}</p>
                </div>
                <p className={cn("border-t pt-3 text-[13px] leading-relaxed", on ? "border-blue-200/70 text-ink-soft" : "border-line text-muted")}>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Postory leans into</span>
                  <br />
                  {detail.focus}
                </p>
              </motion.label>
            );
          })}
        </div>
        {e.businessType ? <p className="mt-3 text-center text-[13px] text-danger">{e.businessType}</p> : null}
      </fieldset>

      <div className="sticky bottom-4 z-10 flex flex-col items-center gap-2 sm:static">
        <div className="w-full rounded-2xl bg-paper/80 p-2 backdrop-blur sm:w-auto sm:bg-transparent sm:p-0">
          <ContinueButton>Continue</ContinueButton>
        </div>
        <p className="text-center text-[13px] text-muted">This helps Postory understand which stories are worth posting for you.</p>
      </div>
    </form>
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
      <input type="hidden" name="businessType" value={defaults.businessType} />
      <Field label="Website" htmlFor="websiteUrl" optional error={e.websiteUrl ?? e.businessType} hint="Postory reads nothing from it on its own — it's just a link it can use in posts.">
        <Input id="websiteUrl" name="websiteUrl" defaultValue={defaults.websiteUrl} placeholder="fernwood.app" inputMode="url" aria-invalid={Boolean(e.websiteUrl) || undefined} />
      </Field>
      <div className="mt-4 flex items-center justify-between">
        <BackButton to="about" />
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
        <BackButton to="business" />
        <ContinueButton>{selected.length ? "Continue" : "Skip for now"}</ContinueButton>
      </div>
    </form>
  );
}

export function FinishButton({ label = "Open Postory", variant = "accent" }: { label?: string; variant?: "accent" | "ghost" }) {
  const [pending, start] = useTransition();
  return (
    <Button size="lg" variant={variant} loading={pending} onClick={() => start(() => completeOnboarding())}>
      {label}
      {!pending && variant === "accent" ? <ArrowRight className="size-4" aria-hidden /> : null}
    </Button>
  );
}
