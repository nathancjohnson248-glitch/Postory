import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { InboxItem } from "@/components/app/inbox/inbox-item";
import { PageHeader } from "@/components/app/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { aiAvailable } from "@/lib/ai/client";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import type { Platform } from "@/lib/social/platforms";
import { formatRelativeDay, safeTimeZone } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inbox" };

const TABS = [
  { id: "needs_reply", label: "Needs reply" },
  { id: "potential_customer", label: "Potential customers" },
  { id: "mention", label: "Mentions" },
  { id: "replied", label: "Replied" },
] as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { tab } = await searchParams;
  const entitlements = await getEntitlements(user.id);
  const tz = safeTimeZone(profile.timezone);

  if (!entitlements.active || !entitlements.features.unifiedInbox) {
    return (
      <>
        <PageHeader title="Inbox" description="Comments, replies and mentions that need you — in one short list." />
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="The inbox comes with Pro and Max."
          description="It gathers the conversations worth answering and lets Postory draft replies for you to approve."
          action={<ButtonLink href="/app/billing">See plans</ButtonLink>}
        />
      </>
    );
  }

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const supabase = await createClient();
  const [{ data: items }, { data: counts }] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("id,platform,author_name,author_handle,content,category,received_at,external_url,reply_draft")
      .eq("user_id", user.id)
      .eq("category", active.id)
      .order("received_at", { ascending: false })
      .limit(50),
    supabase.from("inbox_items").select("category").eq("user_id", user.id).neq("category", "replied"),
  ]);
  const countBy = (counts ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader title="Inbox" description="Comments, replies and mentions that need you — in one short list." />
      <Notice tone="info" title="Nothing can arrive here yet." className="mb-6">
        Postory&apos;s publishing provider (LetMePost) publishes posts but doesn&apos;t yet share comments, replies or messages back. The inbox is
        ready for when it does — until then it stays empty rather than showing anything made up.
      </Notice>
      <nav aria-label="Inbox categories" className="scrollbar-none -mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "needs_reply" ? "/app/inbox" : `/app/inbox?tab=${t.id}`}
            className={cn("flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", t.id === active.id ? "bg-ink text-white" : "text-muted hover:bg-wash hover:text-ink")}
          >
            {t.label}
            {countBy[t.id] ? <span className="rounded-full bg-blue-500 px-1.5 text-[11px] text-white">{countBy[t.id]}</span> : null}
          </Link>
        ))}
      </nav>
      {items?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((i) => (
            <InboxItem
              key={i.id}
              aiEnabled={aiAvailable()}
              when={formatRelativeDay(i.received_at, tz)}
              item={{
                id: i.id,
                platform: i.platform as Platform,
                authorName: i.author_name,
                authorHandle: i.author_handle,
                content: i.content,
                category: i.category,
                receivedAt: i.received_at,
                externalUrl: i.external_url,
                replyDraft: i.reply_draft,
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Inbox className="size-5" />} title="All quiet." description={active.id === "replied" ? "Conversations you've answered land here." : "Nothing is waiting for a reply."} />
      )}
    </>
  );
}
