"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUp, CalendarClock, MessageSquareText, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { askAssistantAction } from "@/app/_actions/assistant";
import { adaptPostAction, reschedulePostAction } from "@/app/_actions/posts";
import { cn } from "@/lib/utils";

type Proposal =
  | { type: "edit_post"; postId: string; instruction: string; label: string }
  | { type: "reschedule_post"; postId: string; scheduledFor: string; label: string }
  | { type: "create_story"; sourceText: string; label: string };

type Message = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };

const SUGGESTIONS = ["What should I post this week?", "Turn my latest story into a launch campaign", "Make the X version shorter"];

export function AssistantPanel({
  enabled,
  disabledReason,
  timezone,
  onUseStory,
}: {
  enabled: boolean;
  disabledReason?: string;
  timezone: string;
  onUseStory: (text: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState<Record<string, "done" | "error">>({});
  const [confirm, setConfirm] = useState<{ proposal: Extract<Proposal, { type: "reschedule_post" }>; key: string } | null>(null);
  const [confirming, startConfirm] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending || !enabled) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      const result = await askAssistantAction({ messages: next.map(({ role, content }) => ({ role, content })) });
      if (!result.ok) {
        setMessages((m) => [...m, { role: "assistant", content: result.error.message }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: result.data.reply, proposals: result.data.proposals as Proposal[] }]);
      }
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }));
    });
  }

  async function apply(proposal: Proposal, key: string) {
    if (proposal.type === "create_story") {
      onUseStory(proposal.sourceText);
      setApplied((a) => ({ ...a, [key]: "done" }));
      toast.success("Added to the composer. Review it, then generate.");
      return;
    }
    if (proposal.type === "reschedule_post") {
      setConfirm({ proposal, key });
      return;
    }
    const result = await adaptPostAction({ postId: proposal.postId, instruction: proposal.instruction });
    setApplied((a) => ({ ...a, [key]: result.ok ? "done" : "error" }));
    if (result.ok) toast.success("Post updated. It's back in review.");
    else toast.error(result.error.message);
  }

  return (
    <aside className="flex h-full min-h-[520px] flex-col rounded-3xl bg-surface shadow-soft ring-1 ring-line lg:sticky lg:top-10 lg:max-h-[calc(100dvh-5rem)]">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <MessageSquareText className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Ask Postory</h2>
          <p className="text-[13px] text-muted">Plans and edits. It suggests; you decide.</p>
        </div>
      </div>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-[13px] text-muted">Try:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!enabled}
                onClick={() => send(s)}
                className="rounded-2xl bg-wash px-3.5 py-2.5 text-left text-[13.5px] text-ink-soft transition-colors hover:bg-[#ecebe6] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
            {!enabled && disabledReason ? <p className="mt-3 text-[13px] text-muted">{disabledReason}</p> : null}
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed", m.role === "user" ? "bg-ink text-white" : "bg-wash text-ink")}>
                <p className="whitespace-pre-line">{m.content}</p>
                {m.proposals?.length ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {m.proposals.map((p, j) => {
                      const key = `${i}-${j}`;
                      const state = applied[key];
                      const Icon = p.type === "reschedule_post" ? CalendarClock : p.type === "edit_post" ? PenLine : Sparkles;
                      return (
                        <li key={key} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
                          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                            <Icon className="size-3.5 shrink-0 text-blue-600" aria-hidden />
                            <span className="truncate">{p.label}</span>
                          </span>
                          {state === "done" ? (
                            <span className="text-xs font-medium text-success">Applied</span>
                          ) : (
                            <ApplyButton onApply={() => apply(p, key)} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {pending ? (
          <div className="flex gap-1.5 px-1" aria-label="Postory is thinking">
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="size-1.5 rounded-full bg-faint" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
            ))}
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl bg-wash p-1.5 focus-within:ring-2 focus-within:ring-blue-100">
          <label htmlFor="assistant-input" className="sr-only">
            Ask Postory
          </label>
          <textarea
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            disabled={!enabled}
            placeholder={enabled ? "Ask about your posts or plan…" : "Unavailable"}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={!enabled || !input.trim() || pending}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-white transition-opacity disabled:opacity-25"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-faint">Each message uses one AI conversation from your plan.</p>
      </form>

      <Dialog
        open={confirm !== null}
        onClose={() => !confirming && setConfirm(null)}
        title="Move this post?"
        description={
          confirm
            ? `It will go out ${new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(confirm.proposal.scheduledFor))} instead.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={confirming}>
              Cancel
            </Button>
            <Button
              loading={confirming}
              onClick={() =>
                startConfirm(async () => {
                  if (!confirm) return;
                  const result = await reschedulePostAction({ postId: confirm.proposal.postId, scheduledFor: confirm.proposal.scheduledFor });
                  setApplied((a) => ({ ...a, [confirm.key]: result.ok ? "done" : "error" }));
                  if (result.ok) toast.success("Rescheduled.");
                  else toast.error(result.error.message);
                  setConfirm(null);
                })
              }
            >
              Move post
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          You can see everything that&apos;s scheduled on the{" "}
          <Link href="/app/calendar" className="font-medium text-blue-600 hover:underline">
            calendar
          </Link>
          .
        </p>
      </Dialog>
    </aside>
  );
}

function ApplyButton({ onApply }: { onApply: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(onApply)}>
      Apply
    </Button>
  );
}
