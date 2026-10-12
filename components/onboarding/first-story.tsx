"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setPostStatus, updatePostContent } from "@/app/_actions/posts";
import { goToStep } from "@/app/onboarding/actions";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { GenerationProgress, type StageId } from "@/components/app/create/generation-progress";
import { CharacterCount, PostPreview } from "@/components/product/post-preview";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/field";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

const MAX_NETWORKS = 4;

export type FirstStoryPost = { id: string; platform: Platform; content: string; status: string; version: number; angle: string | null };
export type FirstStory = { id: string; title: string; summary: string | null; angles: string[]; posts: FirstStoryPost[] };

/** The story composer: one sentence about what happened → Postory writes. */
export function FirstStoryComposer({ defaultPlatforms, previewLeft, examples }: { defaultPlatforms: Platform[]; previewLeft: number; examples: string[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(defaultPlatforms.slice(0, MAX_NETWORKS));
  const [stage, setStage] = useState<StageId | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipping, startSkip] = useTransition();

  const ready = text.trim().length >= 8 && platforms.length > 0 && !running && previewLeft > 0;

  function toggle(p: Platform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : cur.length >= MAX_NETWORKS ? cur : [...cur, p]));
  }

  async function create() {
    if (!ready) return;
    setRunning(true);
    setError(null);
    setStage("understanding");
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: text.trim(), sourceType: "text", platforms, onboarding: true }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Postory couldn't start writing. Try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "stage") setStage(event.stage);
          else if (event.type === "error") throw new Error(event.error?.message ?? "Something went wrong.");
          else if (event.type === "done") {
            router.refresh();
            return;
          }
        }
      }
      throw new Error("The connection dropped before Postory finished. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setRunning(false);
      setStage(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <AnimatePresence mode="wait" initial={false}>
        {running ? (
          <motion.div
            key="working"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl bg-surface p-7 shadow-lift ring-1 ring-line sm:p-9"
          >
            <div className="mb-7 flex items-center gap-3">
              <span className="relative grid size-10 place-items-center rounded-2xl bg-blue-600 text-white">
                <Sparkles className="size-5" aria-hidden />
                <span className="absolute inset-0 animate-ping rounded-2xl bg-blue-500/30" aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-semibold">Postory is writing</p>
                <p className="text-[13px] text-muted">Usually 15–30 seconds.</p>
              </div>
            </div>
            <blockquote className="mb-7 border-l-2 border-blue-200 pl-4 font-display text-[22px] leading-snug text-ink-soft">“{text.trim()}”</blockquote>
            <GenerationProgress current={stage} />
          </motion.div>
        ) : (
          <motion.div key="compose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
            {error ? <Notice tone="danger" title={error} className="mb-5" /> : null}
            {previewLeft === 0 ? (
              <Notice tone="info" title="You've already tried Postory's writer." className="mb-5">
                Start your trial to keep writing — your first story is saved in your Library.
              </Notice>
            ) : null}
            <div className="rounded-3xl bg-surface shadow-lift ring-1 ring-line transition-shadow focus-within:ring-blue-200">
              <label htmlFor="first-story" className="sr-only">
                What happened recently?
              </label>
              <textarea
                id="first-story"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void create();
                  }
                }}
                maxLength={4000}
                rows={4}
                autoFocus
                placeholder="We launched our iOS app today and got 37 downloads in the first hour."
                className="block min-h-40 w-full resize-none rounded-t-3xl bg-transparent px-6 pb-2 pt-6 font-display text-[24px] leading-[1.3] tracking-[-0.01em] text-ink placeholder:text-faint focus:outline-none sm:text-[28px]"
              />
              <div className="border-t border-line px-4 py-4 sm:px-5">
                <p className="mb-2.5 text-[12.5px] font-medium text-muted">
                  Write for <span className="text-faint">· up to {MAX_NETWORKS}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => {
                    const on = platforms.includes(p);
                    const full = !on && platforms.length >= MAX_NETWORKS;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggle(p)}
                        disabled={full}
                        aria-pressed={on}
                        className={cn(
                          "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 transition-all duration-200",
                          on ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line hover:ring-line-strong",
                          full && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <PlatformIcon platform={p} className={cn("size-3.5", on ? "text-white" : "text-ink")} />
                        {PLATFORM_META[p].name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {examples.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-faint">Need a nudge?</span>
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setText(ex)}
                    className="rounded-full bg-wash px-3 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-blue-50 hover:text-ink"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" size="lg" loading={skipping} onClick={() => startSkip(() => goToStep("plan"))}>
                Skip — I&apos;ll try it later
              </Button>
              <Button size="lg" variant="accent" disabled={!ready} onClick={() => void create()}>
                Create my posts
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
            <p className="mt-4 text-center text-[13px] text-muted sm:text-right">Postory only uses what you write here and what you told it about your business.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The aha moment: the story, its angles, and a native post for each network. */
export function FirstStoryResults({ story, authorName, previewLeft }: { story: FirstStory; authorName: string; previewLeft: number }) {
  const [continuing, startContinue] = useTransition();
  const [another, setAnother] = useState(false);
  const router = useRouter();

  if (another) {
    return <FirstStoryComposer defaultPlatforms={story.posts.map((p) => p.platform)} previewLeft={previewLeft} examples={[]} />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mb-8 max-w-2xl rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Your story</p>
        <p className="mt-2 text-[20px] font-semibold tracking-[-0.02em]">{story.title}</p>
        {story.summary ? <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{story.summary}</p> : null}
        {story.angles.length ? (
          <div className="mt-4">
            <p className="mb-2 text-[12.5px] font-medium text-ink-soft">Angles Postory found</p>
            <div className="flex flex-wrap gap-1.5">
              {story.angles.map((a, i) => (
                <motion.span
                  key={a}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="rounded-full bg-blue-50 px-3 py-1 text-[12.5px] font-medium text-blue-700"
                >
                  {a}
                </motion.span>
              ))}
            </div>
          </div>
        ) : null}
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {story.posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <PostCardLite post={post} authorName={authorName} onChange={() => router.refresh()} />
          </motion.div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 text-center">
        <p className="text-[14px] text-muted">
          Every post waits for your approval. Start your trial to schedule these, connect more networks and keep writing.
        </p>
        <Button size="lg" variant="accent" loading={continuing} onClick={() => startContinue(() => goToStep("plan"))}>
          Start my 3-day trial
          {!continuing ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
        {previewLeft > 0 ? (
          <button type="button" onClick={() => setAnother(true)} className="text-[13px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
            Try a different story
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PostCardLite({ post, authorName, onChange }: { post: FirstStoryPost; authorName: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [pending, start] = useTransition();
  const approved = post.status === "approved";

  function save() {
    start(async () => {
      const result = await updatePostContent({ postId: post.id, content: draft, expectedVersion: post.version });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setEditing(false);
      onChange();
    });
  }

  function approve() {
    start(async () => {
      const result = await setPostStatus(post.id, approved ? "awaiting_review" : "approved");
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      onChange();
    });
  }

  return (
    <div className={cn("flex h-full flex-col rounded-3xl bg-surface p-5 shadow-soft ring-1 transition-shadow", approved ? "ring-success/40" : "ring-line")}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <PlatformIcon platform={post.platform} tile className="size-6" />
          {PLATFORM_META[post.platform].name}
        </span>
        {post.angle ? <span className="truncate rounded-full bg-wash px-2.5 py-1 text-[11.5px] text-muted">{post.angle}</span> : null}
      </div>
      {editing ? (
        <div className="flex flex-1 flex-col gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} autoFocus />
          <div className="flex items-center justify-between">
            <CharacterCount platform={post.platform} content={draft} />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} loading={pending}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <PostPreview platform={post.platform} content={post.content} authorName={authorName} className="flex-1" clamp={14} />
      )}
      {!editing ? (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
          <CharacterCount platform={post.platform} content={post.content} />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" icon={<PenLine className="size-3.5" />} onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </Button>
            <Button size="sm" variant={approved ? "secondary" : "primary"} icon={approved ? <Check className="size-3.5" /> : undefined} onClick={approve} loading={pending}>
              {approved ? "Approved" : "Approve"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
