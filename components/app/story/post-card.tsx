"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowUp,
  CalendarClock,
  Check,
  ExternalLink,
  ImagePlus,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { CharacterCount, PostPreview } from "@/components/product/post-preview";
import { PostStatusBadge } from "@/components/product/status-badge";
import { Button, Spinner } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Notice } from "@/components/ui/notice";
import {
  adaptPostAction,
  attachMedia,
  generateImageAction,
  publishPostNow,
  regeneratePost,
  removeMedia,
  schedulePostAction,
  reschedulePostAction,
  setPostAccount,
  setPostStatus,
  unschedulePostAction,
  updatePostContent,
} from "@/app/_actions/posts";
import type { PostView } from "@/lib/data/posts";
import { isEditable } from "@/lib/posts/state-machine";
import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_BYTES } from "@/lib/posts/media";
import { PLATFORM_META, validatePostContent } from "@/lib/social/platforms";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ScheduleDialog } from "./schedule-dialog";

export type PostCardContext = {
  userId: string;
  timezone: string;
  businessName: string;
  accounts: { id: string; name: string }[];
  canPublish: { ok: true } | { ok: false; reason: string; href?: string };
  aiEnabled: boolean;
  factWarnings: string[];
};

type Result = { ok: true } | { ok: false; error: { message: string; action?: { label: string; href: string } } };


/** One-tap edits. Each changes only this network's version and keeps the facts. */
const TONE_PRESETS = [
  { label: "Shorter", instruction: "Make it noticeably shorter. Keep every fact." },
  { label: "More direct", instruction: "Make it more direct: lead with the point, cut hedging and filler." },
  { label: "More playful", instruction: "Make it more playful and light, without changing any facts." },
  { label: "More founder-like", instruction: "Rewrite it in a first-person founder voice — candid and specific, not corporate." },
  { label: "More technical", instruction: "Make it more technical and precise for a knowledgeable audience, using only details already given." },
  { label: "More conversational", instruction: "Make it more conversational, like talking to a friend." },
  { label: "Sound like me", instruction: "Rewrite it to match my brand voice and preferences in business memory as closely as possible." },
];

export function PostCard({ post, ctx }: { post: PostView; ctx: PostCardContext }) {
  const router = useRouter();
  const meta = PLATFORM_META[post.platform];
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState(post.content);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [lastChange, setLastChange] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const editable = isEditable(post.status);
  const dirty = draft !== post.content;
  const issues = validatePostContent(post.platform, mode === "edit" ? draft : post.content, post.media);
  const blocking = issues.filter((i) => i.level === "error");

  async function run(label: string, fn: () => Promise<Result>, success?: string) {
    setBusy(label);
    try {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error.message, result.error.action ? { action: { label: result.error.action.label, onClick: () => router.push(result.error.action!.href) } } : undefined);
        return false;
      }
      if (success) toast.success(success);
      startTransition(() => router.refresh());
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const ok = await run("save", () => updatePostContent({ postId: post.id, content: draft, expectedVersion: post.version }), "Saved.");
    if (ok) setMode("preview");
  }

  async function adapt(preset?: string) {
    const text = (preset ?? instruction).trim();
    if (!text) return;
    setBusy("adapt");
    const result = await adaptPostAction({ postId: post.id, instruction: text });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (!preset) setInstruction("");
    setDraft(result.data.content);
    setLastChange(result.data.summary);
    result.data.warnings.forEach((w) => toast.warning(w));
    startTransition(() => router.refresh());
  }

  async function upload(file: File) {
    if (!ALLOWED_MEDIA_TYPES[file.type]) {
      toast.error("Upload a PNG, JPEG, WebP, GIF, MP4 or MOV file.");
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      toast.error("That file is over 50 MB.");
      return;
    }
    setBusy("upload");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${ctx.userId}/${post.id}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("post-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error("The upload didn't finish. Try again.");
        return;
      }
      const result = await attachMedia({ postId: post.id, storagePath: path });
      if (!result.ok) toast.error(result.error.message);
      else startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  const accountName = post.account?.name ?? ctx.accounts[0]?.name ?? null;

  return (
    <article id={`post-${post.id}`} className="flex scroll-mt-24 flex-col rounded-3xl bg-surface shadow-soft ring-1 ring-line">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformIcon platform={post.platform} tile className="size-9 rounded-xl" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">{meta.name}</p>
            {ctx.accounts.length > 1 && editable ? (
              <select
                aria-label={`${meta.name} account`}
                value={post.account?.id ?? ""}
                onChange={(e) => run("account", () => setPostAccount(post.id, e.target.value || null))}
                className="-ml-1 max-w-48 truncate rounded-md bg-transparent px-1 text-[13px] text-muted hover:bg-wash focus:outline-none"
              >
                <option value="">Choose account</option>
                {ctx.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : accountName ? (
              <p className="truncate text-[13px] text-muted">{accountName}</p>
            ) : (
              <Link href="/app/settings#accounts" className="text-[13px] text-blue-600 hover:underline">
                Connect {meta.name}
              </Link>
            )}
          </div>
        </div>
        <PostStatusBadge status={post.status} />
      </header>

      {post.angle ? <p className="px-5 pt-3 text-[12.5px] text-muted">Angle · {post.angle}</p> : null}

      {/* Body */}
      <div className="px-5 pt-4">
        {editable ? (
          <div className="mb-3 inline-flex rounded-xl bg-wash p-0.5 text-[12.5px] font-medium" role="tablist" aria-label="View">
            {(["preview", "edit"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("rounded-[10px] px-3 py-1 capitalize transition-all", mode === m ? "bg-surface text-ink shadow-hairline" : "text-muted hover:text-ink")}
              >
                {m}
              </button>
            ))}
          </div>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          {mode === "edit" && editable ? (
            <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              <label htmlFor={`content-${post.id}`} className="sr-only">
                {meta.name} post text
              </label>
              <textarea
                id={`content-${post.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "Enter")) {
                    e.preventDefault();
                    if (dirty) save();
                  }
                  if (e.key === "Escape") {
                    setDraft(post.content);
                    setMode("preview");
                  }
                }}
                rows={Math.min(14, Math.max(5, draft.split("\n").length + 2))}
                className="w-full resize-y rounded-2xl bg-paper px-4 py-3 text-[14.5px] leading-relaxed shadow-hairline focus:outline-none focus:shadow-[0_0_0_1px_var(--color-blue-500),0_0_0_4px_rgb(47_91_255/0.12)]"
              />
              <div className="flex items-center justify-between">
                <CharacterCount platform={post.platform} content={draft} />
                <div className="flex gap-2">
                  {dirty ? (
                    <Button size="sm" variant="ghost" onClick={() => setDraft(post.content)}>
                      Discard
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={save} disabled={!dirty} loading={busy === "save"}>
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-paper p-4 ring-1 ring-line">
              <PostPreview
                platform={post.platform}
                content={post.content}
                authorName={ctx.businessName}
                handle={accountName}
                media={post.media.map((m) => ({ kind: m.kind, url: m.url, alt: m.altText }))}
                meta={
                  <>
                    <span>
                      {post.status === "scheduled" && post.scheduledFor
                        ? `Goes out ${formatRelativeDay(post.scheduledFor, ctx.timezone)}`
                        : post.status === "published" && post.publishedAt
                          ? `Published ${formatRelativeDay(post.publishedAt, ctx.timezone)}`
                          : post.lastEditedBy === "user"
                            ? "Edited by you"
                            : "Written by Postory"}
                    </span>
                    <CharacterCount platform={post.platform} content={post.content} />
                  </>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        {lastChange ? (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-blue-700">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {lastChange}
          </p>
        ) : null}

        {/* Warnings */}
        {(ctx.factWarnings.length || blocking.length) && editable ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {[...ctx.factWarnings, ...blocking.map((b) => b.message)].map((w) => (
              <li key={w} className="rounded-xl bg-warning-wash px-3 py-2 text-[13px] text-warning ring-1 ring-inset ring-[#f6e1bb]">
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        {post.status === "failed" && post.errorMessage ? (
          <Notice tone="danger" title={`${meta.name} couldn't be published.`} className="mt-3">
            {post.errorMessage}
            {post.errorCode === "platform_auth_failed" ? (
              <>
                {" "}
                <Link href="/app/settings#accounts" className="font-medium text-blue-600 hover:underline">
                  Reconnect {meta.name}
                </Link>
              </>
            ) : null}
          </Notice>
        ) : null}

        {/* Media */}
        {editable ? (
          <div className="mt-4">
            {post.media.length ? (
              <ul className="mb-3 flex flex-wrap gap-2">
                {post.media.map((m) => (
                  <li key={m.id} className="group relative size-20 overflow-hidden rounded-xl bg-wash ring-1 ring-line">
                    {m.url ? (
                      m.kind === "video" ? (
                        <video src={m.url} className="size-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- signed URL
                        <img src={m.url} alt={m.altText ?? ""} className="size-full object-cover" />
                      )
                    ) : null}
                    <button
                      type="button"
                      onClick={() => run(`remove-${m.id}`, () => removeMedia({ postId: post.id, mediaId: m.id }))}
                      className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/75 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label="Remove media"
                    >
                      {busy === `remove-${m.id}` ? <Spinner className="size-3" /> : <X className="size-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : post.mediaSuggestion ? (
              <p className="mb-3 rounded-xl bg-blue-50/70 px-3 py-2 text-[13px] leading-relaxed text-blue-800">
                <span className="font-medium">Media would help:</span> {post.mediaSuggestion}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {ctx.aiEnabled ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ImagePlus className="size-3.5" />}
                  loading={busy === "image"}
                  disabled={busy !== null}
                  onClick={() => run("image", () => generateImageAction({ postId: post.id, orientation: post.platform === "pinterest" || post.platform === "instagram" ? "portrait" : "square" }), "Image added.")}
                >
                  {post.media.length ? "Generate another" : "Generate image"}
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" icon={<Upload className="size-3.5" />} loading={busy === "upload"} disabled={busy !== null} onClick={() => fileInput.current?.click()}>
                Upload
              </Button>
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                accept={Object.keys(ALLOWED_MEDIA_TYPES).join(",")}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload(file);
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Adapt */}
        {editable && ctx.aiEnabled ? (
          <div className="mt-4 -mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label={`Quick changes for ${meta.name}`}>
            {TONE_PRESETS.map((t) => (
              <button
                key={t.label}
                type="button"
                disabled={busy !== null}
                onClick={() => adapt(t.instruction)}
                className="h-8 shrink-0 rounded-full bg-surface px-3 text-[12.5px] font-medium text-ink-soft ring-1 ring-line transition-all hover:-translate-y-px hover:text-ink hover:ring-line-strong disabled:opacity-40"
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
        {editable && ctx.aiEnabled ? (
          <form
            className="mt-4 flex items-center gap-2 rounded-2xl bg-wash p-1.5 focus-within:ring-2 focus-within:ring-blue-100"
            onSubmit={(e) => {
              e.preventDefault();
              adapt();
            }}
          >
            <Sparkles className="ml-2 size-4 shrink-0 text-blue-500" aria-hidden />
            <label htmlFor={`adapt-${post.id}`} className="sr-only">
              Tell Postory what to change in the {meta.name} post
            </label>
            <input
              id={`adapt-${post.id}`}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={`Tell Postory what to change in ${meta.name}…`}
              maxLength={500}
              disabled={busy === "adapt"}
              className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] placeholder:text-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={!instruction.trim() || busy !== null}
              className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink text-white transition-opacity disabled:opacity-25"
              aria-label="Apply change"
            >
              {busy === "adapt" ? <Spinner className="size-3.5" /> : <ArrowUp className="size-4" />}
            </button>
          </form>
        ) : null}
      </div>

      {/* Footer actions */}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
        <StatusActions
          post={post}
          ctx={ctx}
          busy={busy}
          blocked={blocking.length > 0}
          onRun={run}
          onSchedule={() => setScheduleOpen(true)}
        />
      </footer>

      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        timezone={ctx.timezone}
        title={post.status === "scheduled" ? `Reschedule ${meta.name} post` : `Schedule ${meta.name} post`}
        confirmLabel={post.status === "scheduled" ? "Reschedule" : "Schedule"}
        initial={post.scheduledFor}
        onSubmit={async (iso) => {
          const action = post.status === "scheduled" ? reschedulePostAction : schedulePostAction;
          const result = await action({ postId: post.id, scheduledFor: iso });
          if (!result.ok) return result.error.message;
          toast.success(post.status === "scheduled" ? "Rescheduled." : "Scheduled.");
          startTransition(() => router.refresh());
          return null;
        }}
      />
    </article>
  );
}

function StatusActions({
  post,
  ctx,
  busy,
  blocked,
  onRun,
  onSchedule,
}: {
  post: PostView;
  ctx: PostCardContext;
  busy: string | null;
  blocked: boolean;
  onRun: (label: string, fn: () => Promise<Result>, success?: string) => Promise<boolean>;
  onSchedule: () => void;
}) {
  const meta = PLATFORM_META[post.platform];
  const disabled = busy !== null;
  const publishBlocked = !ctx.canPublish.ok ? ctx.canPublish.reason : blocked ? "Fix the issues above first." : !post.account ? `Choose a ${meta.name} account first.` : null;
  const hasMedia = post.media.length > 0;

  switch (post.status) {
    case "draft":
    case "awaiting_review":
      return (
        <>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} disabled={disabled} loading={busy === "reject"} onClick={() => onRun("reject", () => setPostStatus(post.id, "rejected"))}>
              Reject
            </Button>
            {ctx.aiEnabled ? (
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} disabled={disabled} loading={busy === "regen"} onClick={() => onRun("regen", () => regeneratePost(post.id), "Rewritten. Review the new version.")}>
                Regenerate
              </Button>
            ) : null}
          </div>
          <Button size="sm" variant="accent" icon={<Check className="size-3.5" />} disabled={disabled} loading={busy === "approve"} onClick={() => onRun("approve", () => setPostStatus(post.id, "approved"), "Approved.")}>
            Approve
          </Button>
        </>
      );
    case "approved":
    case "failed":
      return (
        <>
          <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} disabled={disabled} onClick={() => onRun("unapprove", () => setPostStatus(post.id, "awaiting_review"))}>
            Back to review
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {publishBlocked ? <span className="max-w-60 text-right text-xs text-muted">{publishBlocked}</span> : null}
            <Button
              size="sm"
              variant="secondary"
              icon={<CalendarClock className="size-3.5" />}
              disabled={disabled || Boolean(publishBlocked) || hasMedia}
              title={hasMedia ? "Posts with media can't be scheduled through the publishing provider yet — publish now instead." : undefined}
              onClick={onSchedule}
            >
              Schedule
            </Button>
            <ConfirmButton
              size="sm"
              variant="primary"
              confirmVariant="accent"
              icon={<Send className="size-3.5" />}
              disabled={disabled || Boolean(publishBlocked)}
              title={`Publish to ${meta.name} now?`}
              description={`This posts immediately${post.account ? ` to ${post.account.name}` : ""}. Postory can't unpublish it afterwards.`}
              confirmLabel={post.status === "failed" ? "Retry publish" : "Publish now"}
              onConfirm={async () => {
                await onRun("publish", () => publishPostNow(post.id), `Sent to ${meta.name}.`);
              }}
            >
              {post.status === "failed" ? "Retry" : "Publish now"}
            </ConfirmButton>
          </div>
        </>
      );
    case "scheduled":
      return (
        <>
          <p className="text-[13px] text-muted">
            Goes out <span className="font-medium text-ink">{post.scheduledFor ? formatRelativeDay(post.scheduledFor, ctx.timezone) : "soon"}</span>
          </p>
          <div className="flex gap-2">
            <ConfirmButton
              size="sm"
              variant="ghost"
              confirmVariant="primary"
              title="Unschedule this post?"
              description="It goes back to Approved, so you can edit it or pick another time."
              confirmLabel="Unschedule"
              disabled={disabled}
              onConfirm={async () => {
                await onRun("unschedule", () => unschedulePostAction(post.id), "Unscheduled.");
              }}
            >
              Unschedule
            </ConfirmButton>
            <Button size="sm" variant="secondary" icon={<CalendarClock className="size-3.5" />} disabled={disabled} onClick={onSchedule}>
              Reschedule
            </Button>
          </div>
        </>
      );
    case "publishing":
      return (
        <p className="flex items-center gap-2 text-[13px] text-blue-700">
          <Spinner className="size-3.5" /> Publishing to {meta.name}… refresh in a moment to see the result.
        </p>
      );
    case "published":
      return (
        <>
          <p className="text-[13px] text-muted">
            Published {post.publishedAt ? formatRelativeDay(post.publishedAt, ctx.timezone) : ""}
          </p>
          {post.externalUrl ? (
            <a href={post.externalUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:underline">
              View on {meta.name} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </>
      );
    case "rejected":
      return (
        <>
          <p className="text-[13px] text-muted">Rejected — it won&apos;t be published.</p>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onRun("restore", () => setPostStatus(post.id, "awaiting_review"))}>
            Restore to review
          </Button>
        </>
      );
    default:
      return null;
  }
}
