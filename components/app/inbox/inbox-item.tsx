"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Send } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { draftInboxReply, markInboxReplied, sendInboxReplyAction } from "@/app/_actions/inbox";
import { PLATFORM_META } from "@/lib/social/platforms";
import type { Platform } from "@/lib/social/platforms";

export type InboxItemView = {
  id: string;
  platform: Platform;
  authorName: string | null;
  authorHandle: string | null;
  content: string;
  category: string;
  receivedAt: string;
  externalUrl: string | null;
  replyDraft: string | null;
};

const CATEGORY: Record<string, { label: string; tone: "warning" | "blue" | "neutral" | "success" }> = {
  needs_reply: { label: "Needs reply", tone: "warning" },
  potential_customer: { label: "Potential customer", tone: "blue" },
  mention: { label: "Mention", tone: "neutral" },
  replied: { label: "Replied", tone: "success" },
};

export function InboxItem({ item, aiEnabled, when }: { item: InboxItemView; aiEnabled: boolean; when: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(item.replyDraft ?? "");
  const [drafting, startDraft] = useTransition();
  const [marking, startMark] = useTransition();
  const [sending, startSend] = useTransition();
  const canSend = PLATFORM_META[item.platform]?.can.comments;
  const category = CATEGORY[item.category] ?? CATEGORY.needs_reply;

  return (
    <article className="rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={item.platform} tile className="size-8 rounded-[10px]" />
          <div>
            <p className="text-[14px] font-semibold">{item.authorName ?? item.authorHandle ?? "Someone"}</p>
            <p className="text-xs text-muted">
              {item.authorHandle ? `${item.authorHandle} · ` : ""}
              {when}
            </p>
          </div>
        </div>
        <Badge tone={category.tone} dot>
          {category.label}
        </Badge>
      </header>
      <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed">{item.content}</p>

      {item.category !== "replied" ? (
        <div className="mt-4 rounded-2xl bg-wash p-3">
          <label htmlFor={`reply-${item.id}`} className="text-[12.5px] font-medium text-muted">
            Your reply
          </label>
          <textarea
            id={`reply-${item.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Write a reply, or let Postory draft one for you to approve."
            className="mt-1.5 w-full resize-y rounded-xl bg-surface px-3 py-2 text-[14px] shadow-hairline focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {aiEnabled ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<LogoMark className="size-4" blink={false} />}
                loading={drafting}
                onClick={() =>
                  startDraft(async () => {
                    const result = await draftInboxReply(item.id);
                    if (result.ok) setDraft(result.data.reply);
                    else toast.error(result.error.message);
                  })
                }
              >
                Draft reply
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy className="size-3.5" />}
                disabled={!draft.trim()}
                onClick={async () => {
                  await navigator.clipboard.writeText(draft);
                  toast.success("Copied. Paste it on the network, then mark it replied.");
                }}
              >
                Copy
              </Button>
              {item.externalUrl ? (
                <a href={item.externalUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-blue-600 hover:bg-blue-50">
                  Open <ExternalLink className="size-3.5" />
                </a>
              ) : null}
              {canSend ? (
                <Button
                  size="sm"
                  variant="accent"
                  icon={<Send className="size-3.5" />}
                  loading={sending}
                  disabled={!draft.trim() || marking}
                  onClick={() =>
                    startSend(async () => {
                      const result = await sendInboxReplyAction(item.id, draft);
                      if (!result.ok) return void toast.error(result.error.message);
                      toast.success(`Replied on ${PLATFORM_META[item.platform].name}.`);
                      router.refresh();
                    })
                  }
                >
                  Send reply
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={canSend ? "ghost" : "primary"}
                icon={<Check className="size-3.5" />}
                loading={marking}
                onClick={() =>
                  startMark(async () => {
                    const result = await markInboxReplied(item.id);
                    if (result.ok) router.refresh();
                    else toast.error(result.error.message);
                  })
                }
              >
                Mark replied
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
