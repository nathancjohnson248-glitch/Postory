"use client";

import { showError } from "@/lib/client/show-error";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendProductUpdate, type ProductUpdateInput } from "@/app/_actions/updates";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input, Textarea } from "@/components/ui/field";

const EMPTY = { subject: "", headline: "", body: "", ctaLabel: "", ctaUrl: "" } satisfies ProductUpdateInput;

/** Write once, send a test to yourself, then send to everyone who hasn't opted out. */
export function ProductUpdateComposer({ recipients, ownerEmail }: { recipients: number; ownerEmail: string }) {
  const [draft, setDraft] = useState(EMPTY);
  const [tested, setTested] = useState(false);
  const [testing, startTest] = useTransition();
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
    setTested(false);
  };

  function test() {
    startTest(async () => {
      const result = await sendProductUpdate({ ...draft, mode: "test" });
      if (!result.ok) return void showError(result.error);
      setTested(true);
      toast.success(`Test sent to ${ownerEmail}. Check how it looks, then send it to everyone.`);
    });
  }

  async function sendAll() {
    const result = await sendProductUpdate({ ...draft, mode: "all" });
    if (!result.ok) return void showError(result.error);
    const { sent, failed } = result.data;
    if (failed) toast.warning(`Sent to ${sent}. ${failed} didn't go through. The sender may be rate-limited, so try those again later.`, { duration: 10_000 });
    else toast.success(`Sent to ${sent} ${sent === 1 ? "person" : "people"}.`);
    setDraft(EMPTY);
    setTested(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Subject" htmlFor="u-subject" hint="What shows in the inbox.">
        <Input id="u-subject" value={draft.subject} onChange={set("subject")} maxLength={150} placeholder="New: Postory now posts to Pinterest" />
      </Field>
      <Field label="Headline" htmlFor="u-headline">
        <Input id="u-headline" value={draft.headline} onChange={set("headline")} maxLength={150} placeholder="Pinterest is here." />
      </Field>
      <Field label="Message" htmlFor="u-body" hint="Plain text. Leave a blank line between paragraphs. The footer says replies aren't read and where to reach you.">
        <Textarea id="u-body" value={draft.body} onChange={set("body")} maxLength={8000} className="min-h-56" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="Button label" htmlFor="u-cta" optional>
          <Input id="u-cta" value={draft.ctaLabel} onChange={set("ctaLabel")} maxLength={40} placeholder="Open Postory" />
        </Field>
        <Field label="Button link" htmlFor="u-url" optional>
          <Input id="u-url" type="url" value={draft.ctaUrl} onChange={set("ctaUrl")} placeholder="https://postory.lol/app" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button variant="secondary" onClick={test} loading={testing} icon={<Send className="size-4" aria-hidden />}>
          Send a test to me
        </Button>
        <ConfirmButton
          variant="accent"
          confirmVariant="accent"
          disabled={!tested || recipients === 0}
          title={`Send to ${recipients} ${recipients === 1 ? "person" : "people"}?`}
          description="Everyone with product updates turned on gets this now. It can't be unsent."
          confirmLabel="Send update"
          onConfirm={sendAll}
        >
          Send to {recipients} {recipients === 1 ? "person" : "people"}
        </ConfirmButton>
        {!tested ? <p className="text-[13px] text-muted">Send yourself a test first.</p> : null}
      </div>
    </div>
  );
}
