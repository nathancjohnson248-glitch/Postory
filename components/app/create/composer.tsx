"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Sparkles } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { GenerationProgress, type StageId } from "./generation-progress";
import { useDictation } from "./use-dictation";

export type GenerationAvailability =
  | { ok: true; remaining: number; limit: number }
  | { ok: false; reason: string; action?: { label: string; href: string } };

type ApiError = { code: string; message: string; action?: { label: string; href: string } };

export function Composer({
  connected,
  defaultPlatforms,
  availability,
  text,
  onTextChange,
}: {
  connected: { platform: Platform; name: string }[];
  defaultPlatforms: Platform[];
  availability: GenerationAvailability;
  text: string;
  onTextChange: (text: string) => void;
}) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>(() => {
    const initial = [...new Set(defaultPlatforms.length ? defaultPlatforms : connected.map((c) => c.platform))];
    return initial.length ? initial : ["x", "linkedin", "instagram"];
  });
  const [sourceType, setSourceType] = useState<"text" | "voice">("text");
  const [stage, setStage] = useState<StageId | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const dictation = useDictation((spoken) => {
    setSourceType("voice");
    onTextChange(text ? `${text.trimEnd()} ${spoken}` : spoken);
  });

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  const connectedSet = new Set(connected.map((c) => c.platform));
  const canGenerate = availability.ok && text.trim().length >= 8 && platforms.length > 0 && !running;

  async function generate() {
    if (!canGenerate) return;
    setRunning(true);
    setError(null);
    setStage(null);
    setSavedStoryId(null);
    let storyId: string | null = null;
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: text.trim(), sourceType, platforms }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw body?.error ?? { code: "unexpected", message: "Generation couldn't start. Try again." };
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
          if (event.type === "story") {
            storyId = event.storyId;
            setSavedStoryId(event.storyId);
          } else if (event.type === "stage") {
            setStage(event.stage);
          } else if (event.type === "done") {
            router.push(`/app/library/${event.storyId}?generated=1`);
            return;
          } else if (event.type === "error") {
            throw event.error;
          }
        }
      }
      throw { code: "interrupted", message: "The connection dropped before Postory finished." };
    } catch (e) {
      const err = (e && typeof e === "object" && "message" in e ? e : { code: "unexpected", message: "Something went wrong. Try again." }) as ApiError;
      setError(err);
      setRunning(false);
      setStage(null);
      if (storyId) setSavedStoryId(storyId);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={cn("rounded-3xl bg-surface shadow-lift ring-1 ring-line transition-shadow focus-within:ring-blue-200", running && "opacity-90")}>
        <label htmlFor="story" className="sr-only">
          What happened?
        </label>
        <textarea
          ref={textarea}
          id="story"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              generate();
            }
          }}
          disabled={running}
          maxLength={8000}
          rows={6}
          placeholder="We launched our new product today…"
          className="block min-h-48 w-full resize-none rounded-t-3xl bg-transparent px-6 pb-2 pt-6 font-display text-[26px] leading-[1.3] tracking-[-0.01em] text-ink placeholder:text-faint focus:outline-none sm:text-[30px]"
        />
        <div className="flex items-center justify-between gap-3 px-4 pb-4">
          <div className="flex items-center gap-2">
            {dictation.supported ? (
              <button
                type="button"
                onClick={dictation.toggle}
                disabled={running}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition-colors",
                  dictation.listening ? "bg-danger-wash text-danger" : "text-muted hover:bg-wash hover:text-ink",
                )}
                aria-pressed={dictation.listening}
              >
                <Mic className={cn("size-4", dictation.listening && "animate-pulse")} aria-hidden />
                {dictation.listening ? "Listening… tap to stop" : "Dictate"}
              </button>
            ) : null}
            {dictation.error ? <span className="text-xs text-danger">{dictation.error}</span> : null}
          </div>
          <span className="font-mono text-[11px] text-faint">{text.length.toLocaleString()}/8,000</span>
        </div>
      </div>

      <fieldset disabled={running}>
        <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">Write for</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = platforms.includes(p);
            const isConnected = connectedSet.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                aria-pressed={on}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[13px] font-medium ring-1 transition-all duration-200",
                  on ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line hover:ring-line-strong",
                )}
                title={isConnected ? undefined : "Not connected — Postory writes a draft you can publish after connecting."}
              >
                <PlatformIcon platform={p} tile className="size-7 rounded-full" />
                {PLATFORM_META[p].name}
                {!isConnected ? <span className={cn("text-[11px] font-normal", on ? "text-white/50" : "text-faint")}>draft</span> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <AnimatePresence mode="wait">
        {running ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line"
          >
            <GenerationProgress current={stage} />
          </motion.div>
        ) : (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            {error ? (
              <Notice
                tone="danger"
                title={error.message}
                action={
                  error.action || savedStoryId ? (
                    <div className="flex flex-wrap gap-2">
                      {error.action ? (
                        <ButtonLink href={error.action.href} size="sm" variant="secondary">
                          {error.action.label}
                        </ButtonLink>
                      ) : null}
                      {savedStoryId ? (
                        <ButtonLink href={`/app/library/${savedStoryId}`} size="sm" variant="ghost">
                          Open the saved story
                        </ButtonLink>
                      ) : null}
                    </div>
                  ) : undefined
                }
              >
                {savedStoryId ? "Your story was saved, so you won't lose what you wrote." : null}
              </Notice>
            ) : null}
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-muted">
                {availability.ok ? (
                  <>
                    {availability.remaining} of {availability.limit} generations left this period ·{" "}
                    <kbd className="font-mono text-[11px]">⌘↵</kbd> to generate
                  </>
                ) : (
                  <>
                    {availability.reason}
                    {availability.action ? (
                      <>
                        {" "}
                        <Link href={availability.action.href} className="font-medium text-blue-600 hover:underline">
                          {availability.action.label}
                        </Link>
                      </>
                    ) : null}
                  </>
                )}
              </p>
              <Button size="lg" variant="accent" disabled={!canGenerate} onClick={generate} icon={<Sparkles className="size-4" />}>
                Generate posts
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
