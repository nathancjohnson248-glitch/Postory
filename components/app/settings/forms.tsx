"use client";

import { showError } from "@/lib/client/show-error";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { addMemory, deleteMemory, updateMemory } from "@/app/_actions/memory";
import {
  deleteAccount,
  updateAiPreferences,
  updateBusinessSettings,
  updateNotificationSettings,
  updateProfileSettings,
  updateVoiceSettings,
} from "@/app/_actions/settings";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { BUSINESS_TYPES, VOICE_PRESETS } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: import("@/lib/errors").ActionError };

function listTimeZones(fallback: string): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [fallback];
  } catch {
    return [fallback];
  }
}

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<Result>, message = "Saved.") =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(message);
        router.refresh();
      } else showError(result.error);
    });
  return { pending, save };
}

export function SettingsCard({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl bg-surface shadow-soft ring-1 ring-line">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-[16px] font-semibold tracking-[-0.015em]">{title}</h2>
        {description ? <p className="mt-1 text-[13.5px] text-muted">{description}</p> : null}
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

/** The one email a user can turn off: product updates. Everything else is sent only when something needs them. */
export function ProductUpdatesToggle({ enabled }: { enabled: boolean }) {
  const { pending, save } = useSave();
  const [on, setOn] = useState(enabled);
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[14px] font-medium">Product updates</span>
        <span className="block text-[13px] text-muted">An occasional email when something new ships in Postory. A few a month at most.</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Product update emails"
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          save(() => updateNotificationSettings({ productUpdates: next }), next ? "Product updates on." : "Product updates off.");
        }}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60",
          on ? "bg-blue-600" : "bg-line-strong",
        )}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

export function ProfileForm({ name, email, timezone }: { name: string; email: string; timezone: string }) {
  const { pending, save } = useSave();
  const zones = useMemo(() => listTimeZones(timezone), [timezone]);
  return (
    <form
      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save(() => updateProfileSettings({ name: String(f.get("name")), timezone: String(f.get("timezone")) }));
      }}
    >
      <Field label="Name" htmlFor="profile-name">
        <Input id="profile-name" name="name" defaultValue={name} required maxLength={80} autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="profile-email" hint="Your sign-in email.">
        <Input id="profile-email" value={email} readOnly disabled />
      </Field>
      <Field label="Timezone" htmlFor="profile-tz" hint="The calendar and scheduling use this." className="sm:col-span-2">
        <Select id="profile-tz" name="timezone" defaultValue={timezone}>
          {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function BusinessForm(props: { businessName: string; businessDescription: string; businessType: string; websiteUrl: string }) {
  const { pending, save } = useSave();
  return (
    <form
      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        save(() => updateBusinessSettings(f));
      }}
    >
      <Field label="Business name" htmlFor="b-name">
        <Input id="b-name" name="businessName" defaultValue={props.businessName} required maxLength={120} />
      </Field>
      <Field label="Business type" htmlFor="b-type">
        <Select id="b-type" name="businessType" defaultValue={props.businessType || BUSINESS_TYPES[0]}>
          {props.businessType && !(BUSINESS_TYPES as readonly string[]).includes(props.businessType) ? <option>{props.businessType}</option> : null}
          {BUSINESS_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="What you do" htmlFor="b-desc" className="sm:col-span-2">
        <Textarea id="b-desc" name="businessDescription" defaultValue={props.businessDescription} rows={3} maxLength={1000} required />
      </Field>
      <Field label="Website" htmlFor="b-web" optional className="sm:col-span-2">
        <Input id="b-web" name="websiteUrl" defaultValue={props.websiteUrl} placeholder="example.com" />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save business
        </Button>
      </div>
    </form>
  );
}

export function VoiceForm({ presets, notes }: { presets: string[]; notes: string }) {
  const { pending, save } = useSave();
  const [selected, setSelected] = useState(presets);
  const [text, setText] = useState(notes);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => updateVoiceSettings({ presets: selected, notes: text }));
      }}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Voice">
        {VOICE_PRESETS.map((p) => {
          const on = selected.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p) : [...s, p]))}
              className={cn("rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors", on ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line hover:ring-line-strong")}
            >
              {p}
            </button>
          );
        })}
      </div>
      <Field label="In your own words" htmlFor="voice-notes" optional>
        <Textarea id="voice-notes" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save voice
        </Button>
      </div>
    </form>
  );
}

export function AiPreferencesForm({ defaultPlatforms, emoji, hashtags }: { defaultPlatforms: Platform[]; emoji: string; hashtags: string }) {
  const { pending, save } = useSave();
  const [platforms, setPlatforms] = useState<Platform[]>(defaultPlatforms);
  const [emojiPref, setEmoji] = useState(emoji);
  const [hashPref, setHash] = useState(hashtags);
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          updateAiPreferences({
            defaultPlatforms: platforms,
            emoji: emojiPref as "never" | "sparingly" | "voice",
            hashtags: hashPref as "never" | "sparingly" | "platform",
          }),
        );
      }}
    >
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">Write for these networks by default</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                className={cn("flex h-9 items-center gap-2 rounded-full pl-1 pr-3 text-[13px] font-medium ring-1 transition-colors", on ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line")}
              >
                <PlatformIcon platform={p} tile className="size-7 rounded-full" />
                {PLATFORM_META[p].name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12.5px] text-muted">Leave empty to use whichever networks you&apos;ve connected.</p>
      </fieldset>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Emoji" htmlFor="ai-emoji">
          <Select id="ai-emoji" value={emojiPref} onChange={(e) => setEmoji(e.target.value)}>
            <option value="voice">Only if my voice calls for it</option>
            <option value="sparingly">Sparingly</option>
            <option value="never">Never</option>
          </Select>
        </Field>
        <Field label="Hashtags" htmlFor="ai-hash">
          <Select id="ai-hash" value={hashPref} onChange={(e) => setHash(e.target.value)}>
            <option value="platform">Where the platform expects them</option>
            <option value="sparingly">Sparingly</option>
            <option value="never">Never</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}

export type MemoryRow = { id: string; category: string; key: string; value: string; source: string };

const MEMORY_CATEGORIES = [
  ["business", "Business"],
  ["product", "Product"],
  ["audience", "Audience"],
  ["brand", "Brand"],
  ["milestone", "Milestone"],
  ["facts", "Fact"],
  ["preferences", "Preference"],
  ["approved_content", "Approved wording"],
] as const;

export function MemoryManager({ rows }: { rows: MemoryRow[] }) {
  const { pending, save } = useSave();
  const [editing, setEditing] = useState<MemoryRow | null>(null);
  const [editValue, setEditValue] = useState("");
  const visible = rows.filter((r) => r.category !== "voice");
  const label = (c: string) => MEMORY_CATEGORIES.find(([id]) => id === c)?.[1] ?? c;

  return (
    <div className="flex flex-col gap-6">
      <form
        className="grid grid-cols-1 gap-3 rounded-2xl bg-wash p-4 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          save(async () => {
            const result = await addMemory({ category: String(f.get("category")), key: String(f.get("key")), value: String(f.get("value")) });
            if (result.ok) form.reset();
            return result;
          }, "Added to memory.");
        }}
      >
        <Field label="Type" htmlFor="m-cat">
          <Select id="m-cat" name="category" defaultValue="facts">
            {MEMORY_CATEGORIES.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Label" htmlFor="m-key">
          <Input id="m-key" name="key" placeholder="Pricing" required maxLength={120} />
        </Field>
        <Field label="Detail" htmlFor="m-val">
          <Input id="m-val" name="value" placeholder="Plans start at $9/month" required maxLength={4000} />
        </Field>
        <Button type="submit" loading={pending} icon={<Plus className="size-4" />}>
          Add
        </Button>
      </form>

      {visible.length ? (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {visible.map((r) => (
            <li key={r.id} className="flex items-start gap-4 px-4 py-3">
              <span className="mt-0.5 w-28 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{label(r.category)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink-soft">{r.key.replace(/-[a-z0-9]{6,}$/, "").replace(/-/g, " ")}</p>
                <p className="text-[14px] leading-relaxed">{r.value}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(r);
                    setEditValue(r.value);
                  }}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-wash hover:text-ink"
                  aria-label={`Edit ${r.key}`}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => save(() => deleteMemory(r.id), "Removed.")}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-wash hover:text-danger"
                  aria-label={`Delete ${r.key}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No facts saved yet. Add the things Postory should know — pricing, who you serve, what you&apos;ve shipped.</p>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit memory"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                if (!editing) return;
                save(async () => {
                  const result = await updateMemory(editing.id, editValue);
                  if (result.ok) setEditing(null);
                  return result;
                });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label={editing?.key ?? ""} htmlFor="m-edit">
          <Textarea id="m-edit" value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={4} maxLength={4000} />
        </Field>
      </Dialog>
    </div>
  );
}

export function DeleteAccount({ trigger = "button" }: { trigger?: "button" | "link" }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {trigger === "link" ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 text-sm text-faint transition-colors hover:text-danger">
          Delete account
        </button>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)} icon={<Trash2 className="size-4" />}>
          Delete account
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Delete your Postory account?"
        description="This permanently deletes your stories, posts, media, business memory and connections from Postory. Posts already published stay on the networks. Your subscription is cancelled first."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={confirm !== "DELETE"}
              onClick={() =>
                start(async () => {
                  const result = await deleteAccount(confirm);
                  if (result && !result.ok) setError(result.error.message);
                })
              }
            >
              Delete everything
            </Button>
          </>
        }
      >
        {error ? <Notice tone="danger" title={error} className="mb-4" /> : null}
        <Field label="Type DELETE to confirm" htmlFor="delete-confirm">
          <Input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </Dialog>
    </>
  );
}
