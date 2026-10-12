"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Inbox, Paperclip, PenSquare, RefreshCw, Reply, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { openMail, replyMail, sendMail } from "@/app/_actions/mail";
import type { MailFolder, MailSummary } from "@/lib/email/zoho";
import { cn } from "@/lib/utils";

const TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Emails are untrusted HTML: render them in a sandbox with no scripts and no access to this page. */
function MessageFrame({ html }: { html: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:4px 2px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0c0c0e;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#2048e6}</style></head><body>${html}</body></html>`;
  return <iframe title="Message" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[60vh] w-full rounded-xl bg-white" />;
}

type Draft = { mode: "new" | "reply"; to: string; subject: string; body: string; messageId?: string };

export function Mailbox({ folders, folderId, messages, address }: { folders: MailFolder[]; folderId: string; messages: MailSummary[]; address: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<MailSummary | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, startSend] = useTransition();
  const [refreshing, startRefresh] = useTransition();

  async function show(message: MailSummary) {
    setOpen(message);
    setHtml(null);
    setLoading(true);
    const result = await openMail(message.folderId, message.id);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setHtml(result.data?.html ?? "");
    setReadIds((s) => new Set(s).add(message.id));
  }

  function send() {
    if (!draft) return;
    startSend(async () => {
      const result =
        draft.mode === "reply" && draft.messageId
          ? await replyMail({ messageId: draft.messageId, to: draft.to, subject: draft.subject, body: draft.body })
          : await sendMail({ to: draft.to, subject: draft.subject, body: draft.body });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Sent.");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none">
          {folders.map((f) => (
            <Link
              key={f.id}
              href={`/app/admin/mail?folder=${f.id}`}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                f.id === folderId ? "text-white" : "text-muted hover:text-ink",
              )}
            >
              {f.id === folderId ? <motion.span layoutId="mail-folder" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
              <span className="relative">{f.name}</span>
              {f.unread ? <span className={cn("relative tabular-nums", f.id === folderId ? "text-white/60" : "text-blue-600")}>{f.unread}</span> : null}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" loading={refreshing} onClick={() => startRefresh(() => router.refresh())} icon={<RefreshCw className="size-3.5" />}>
            Refresh
          </Button>
          <Button size="sm" variant="accent" onClick={() => setDraft({ mode: "new", to: "", subject: "", body: "" })} icon={<PenSquare className="size-3.5" />}>
            Compose
          </Button>
        </div>
      </div>

      <div className="grid min-h-[60vh] grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <ul className={cn("divide-y divide-line border-line lg:border-r", open && "hidden lg:block")}>
          {messages.length ? (
            messages.map((m, i) => {
              const unread = m.unread && !readIds.has(m.id);
              return (
                <motion.li key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <button
                    type="button"
                    onClick={() => show(m)}
                    className={cn("flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-wash/70 sm:px-5", open?.id === m.id && "bg-blue-50/60")}
                  >
                    <span className="flex items-center gap-2">
                      {unread ? <span className="size-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" /> : null}
                      <span className={cn("min-w-0 flex-1 truncate text-[14px]", unread ? "font-semibold" : "font-medium text-ink-soft")}>{m.fromName || m.from}</span>
                      {m.hasAttachment ? <Paperclip className="size-3.5 shrink-0 text-faint" aria-label="Has attachment" /> : null}
                      <span className="shrink-0 text-[12px] tabular-nums text-faint">{TIME.format(new Date(m.receivedAt))}</span>
                    </span>
                    <span className={cn("truncate text-[13.5px]", unread ? "text-ink" : "text-ink-soft")}>{m.subject}</span>
                    <span className="line-clamp-1 text-[12.5px] text-muted">{m.summary}</span>
                  </button>
                </motion.li>
              );
            })
          ) : (
            <li className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Inbox className="size-6 text-faint" aria-hidden />
              <p className="text-[14px] font-medium">Nothing here yet</p>
              <p className="text-[13px] text-muted">Mail sent to {address} shows up here.</p>
            </li>
          )}
        </ul>

        <div className={cn("min-w-0 p-4 sm:p-6", !open && "hidden lg:block")}>
          <AnimatePresence mode="wait">
            {open ? (
              <motion.article key={open.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <button type="button" onClick={() => setOpen(null)} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink lg:hidden">
                  <ArrowLeft className="size-4" aria-hidden /> All messages
                </button>
                <h2 className="text-[20px] font-semibold leading-snug tracking-[-0.02em]">{open.subject}</h2>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">
                    <span className="font-medium text-ink-soft">{open.fromName}</span> {open.from !== open.fromName ? `<${open.from}>` : ""} · {TIME.format(new Date(open.receivedAt))}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Reply className="size-3.5" />}
                    onClick={() =>
                      setDraft({ mode: "reply", messageId: open.id, to: open.from, subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`, body: "" })
                    }
                  >
                    Reply
                  </Button>
                </div>
                <div className="mt-5">{loading ? <div className="skeleton h-[40vh] w-full rounded-xl" /> : html !== null ? <MessageFrame html={html} /> : null}</div>
              </motion.article>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid h-full place-items-center text-center">
                <p className="text-[14px] text-muted">Select a message to read it.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Dialog
        open={Boolean(draft)}
        onClose={() => !sending && setDraft(null)}
        title={draft?.mode === "reply" ? "Reply" : "New message"}
        description={`From ${address}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="accent" loading={sending} onClick={send} icon={<Send className="size-4" />}>
              Send
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <Field label="To" htmlFor="mail-to" hint="Separate several addresses with commas.">
              <Input id="mail-to" type="text" inputMode="email" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} autoFocus={draft.mode === "new"} />
            </Field>
            <Field label="Subject" htmlFor="mail-subject">
              <Input id="mail-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </Field>
            <Field label="Message" htmlFor="mail-body">
              <Textarea id="mail-body" rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} autoFocus={draft.mode === "reply"} />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
