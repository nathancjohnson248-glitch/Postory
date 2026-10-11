"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { buttonClasses } from "@/components/ui/button";
import { PLATFORMS, PLATFORM_META, countCharacters, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

const URL_PATTERN = /https?:\/\/\S+/gi;
/** X counts every link as 23 characters, however long it is. */
const X_LINK_LENGTH = 23;

function countFor(platform: Platform, text: string) {
  if (platform !== "x") return countCharacters(text);
  const links = text.match(URL_PATTERN) ?? [];
  return countCharacters(text.replace(URL_PATTERN, "")) + links.length * X_LINK_LENGTH;
}

const MEDIA_NOTE: Record<(typeof PLATFORM_META)[Platform]["mediaRequired"], string> = {
  none: "",
  image_or_video: "Needs an image or video too",
  video: "Needs a video too",
};

const SAMPLE = "We launched our iOS app today and got 37 downloads in the first hour. Thank you to everyone who tried it — tell us what you'd like next.";

export function CharacterCounter() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split("\n").length : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
      <div className="flex flex-col rounded-3xl bg-surface shadow-lift ring-1 ring-line transition-shadow focus-within:ring-blue-200">
        <label htmlFor="counter-text" className="sr-only">
          Your post
        </label>
        <textarea
          id="counter-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          placeholder="Paste or write your post…"
          className="min-h-72 w-full flex-1 resize-none rounded-t-3xl bg-transparent px-6 pb-3 pt-6 text-[17px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="tabular-nums text-ink-soft">{countCharacters(text).toLocaleString("en-US")}</span> characters ·{" "}
            <span className="tabular-nums text-ink-soft">{words.toLocaleString("en-US")}</span> words ·{" "}
            <span className="tabular-nums text-ink-soft">{lines.toLocaleString("en-US")}</span> lines
          </p>
          <div className="flex items-center gap-1">
            {!text ? (
              <button type="button" onClick={() => setText(SAMPLE)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-wash hover:text-ink">
                Try an example
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    } catch {
                      // Clipboard can be blocked; the text is still selectable.
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-wash hover:text-ink"
                >
                  {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={() => setText("")} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-wash hover:text-ink">
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-surface p-2 shadow-soft ring-1 ring-line">
        <ul className="divide-y divide-line">
          {PLATFORMS.map((platform) => {
            const meta = PLATFORM_META[platform];
            const used = countFor(platform, text);
            const share = Math.min(1, used / meta.charLimit);
            const over = used > meta.charLimit;
            const left = meta.charLimit - used;
            return (
              <li key={platform} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={platform} tile className="size-7 rounded-lg" />
                  <span className="flex-1 text-[14px] font-medium">{meta.name}</span>
                  <span className={cn("font-mono text-[12px] tabular-nums", over ? "font-semibold text-danger" : "text-muted")}>
                    {used.toLocaleString("en-US")} / {meta.charLimit.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-wash">
                  <motion.div
                    className={cn("h-full rounded-full", over ? "bg-danger" : share > 0.9 ? "bg-warning" : "bg-blue-500")}
                    initial={false}
                    animate={{ width: `${share * 100}%` }}
                    transition={{ type: "spring", stiffness: 260, damping: 32 }}
                  />
                </div>
                <p className={cn("mt-1.5 text-[12px]", over ? "text-danger" : "text-faint")}>
                  {!text
                    ? MEDIA_NOTE[meta.mediaRequired] || "\u00a0"
                    : over
                      ? `${Math.abs(left).toLocaleString("en-US")} over — trim it or split it.`
                      : `${left.toLocaleString("en-US")} left${MEDIA_NOTE[meta.mediaRequired] ? ` · ${MEDIA_NOTE[meta.mediaRequired].toLowerCase()}` : ""}`}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="m-2 mt-1 flex flex-col gap-3 rounded-2xl bg-wash p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-ink-soft">Postory writes each version to fit — then waits for your approval.</p>
          <Link href="/signup" className={buttonClasses({ size: "sm", variant: "accent", className: "group h-9 shrink-0 px-3.5" })}>
            Try Postory <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
