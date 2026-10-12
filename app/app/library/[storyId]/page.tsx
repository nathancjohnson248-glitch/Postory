import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GenerateForStory } from "@/components/app/story/generate-for-story";
import { MissingInfo } from "@/components/app/story/missing-info";
import { PostCard, type PostCardContext } from "@/components/app/story/post-card";
import { StoryToolbar } from "@/components/app/story/story-toolbar";
import { GeneratedToast } from "@/components/app/story/generated-toast";
import { AnglePicker } from "@/components/app/story/angle-picker";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { aiAvailable } from "@/lib/ai/client";
import { factCorpus, loadBusinessContext } from "@/lib/ai/context";
import { findUnsupportedNumbers } from "@/lib/ai/factuality";
import { requireAppAccess } from "@/lib/auth/access";
import { reconcileQuietly } from "@/lib/data/home";
import { getStory } from "@/lib/data/posts";
import { getEntitlements } from "@/lib/entitlements";
import { STATUS_LABEL, type PostStatus } from "@/lib/posts/state-machine";
import { getSocialReadiness } from "@/lib/social/service";
import { createClient } from "@/lib/supabase/server";
import { formatInZone, safeTimeZone } from "@/lib/time";
import { idSchema } from "@/lib/validation/schemas";
import type { Platform } from "@/lib/social/platforms";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Story" };
export const maxDuration = 60;

type Analysis = { angles?: string[]; missingInformation?: string[]; schedulingSuggestion?: string | null };

export default async function StoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!idSchema.safeParse(storyId).success) notFound();
  const { user, profile } = await requireAppAccess();
  await reconcileQuietly(user.id);

  const supabase = await createClient();
  const [data, entitlements, readiness, context, { data: accounts }] = await Promise.all([
    getStory(user.id, storyId),
    getEntitlements(user.id),
    getSocialReadiness(user.id),
    loadBusinessContext(user.id),
    supabase.from("social_accounts").select("id,platform,username,display_name").eq("user_id", user.id).eq("status", "connected"),
  ]);
  if (!data) notFound();
  const { story, posts } = data;
  const tz = safeTimeZone(profile.timezone);
  const analysis = (Array.isArray(story.angles) ? { angles: story.angles as string[] } : (story.angles as Analysis)) ?? {};
  const corpus = factCorpus(context, story.source_text);

  const canPublish: PostCardContext["canPublish"] = !readiness.ready
    ? { ok: false, reason: readiness.reason === "provider_not_configured" ? "Publishing isn't configured yet." : "Publishing workspace not linked yet." }
    : !entitlements.active
      ? { ok: false, reason: "Publishing needs a plan.", href: "/app/billing" }
      : { ok: true };

  const counts = posts.reduce<Partial<Record<PostStatus, number>>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
  const reviewCount = (counts.awaiting_review ?? 0) + (counts.draft ?? 0);
  const prefs = profile.ai_preferences as { defaultPlatforms?: Platform[] } | null;

  return (
    <div className="flex flex-col gap-8">
      <Suspense>
        <GeneratedToast />
      </Suspense>
      <div>
        <Link href="/app/library" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-3.5" /> Library
        </Link>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Story · {formatInZone(story.created_at, tz, { month: "short", day: "numeric", year: "numeric" })}
          {story.source_type === "voice" ? " · dictated" : ""}
          {story.status === "archived" ? " · archived" : ""}
        </p>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <h1
            className={`min-w-0 max-w-4xl font-display leading-[0.98] tracking-[-0.02em] text-balance ${story.title.length > 36 ? "text-[40px] sm:text-[52px]" : "text-[48px] sm:text-[68px]"}`}
          >
            {story.title}
          </h1>
          <div className="xl:shrink-0">
            <StoryToolbar storyId={story.id} archived={story.status === "archived"} reviewCount={reviewCount} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <blockquote className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line sm:p-8">
          <p className="font-display text-[26px] leading-[1.3] tracking-[-0.01em] text-ink sm:text-[30px]">“{story.source_text}”</p>
          {story.summary ? <p className="mt-5 border-t border-line pt-4 text-[14px] leading-relaxed text-muted">{story.summary}</p> : null}
        </blockquote>
        <div className="flex flex-col gap-4">
          {analysis.angles?.length ? (
            <div className="rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
              <p className="text-[13px] font-semibold">Angles</p>
              {aiAvailable() && entitlements.active ? <p className="mt-0.5 text-[12.5px] text-muted">Tap one to rewrite the open drafts around it.</p> : null}
              <AnglePicker
                storyId={story.id}
                angles={analysis.angles}
                current={posts.length && posts.every((p) => p.angle === posts[0].angle) ? (posts[0].angle ?? null) : null}
                aiEnabled={aiAvailable() && entitlements.active}
              />
              {analysis.schedulingSuggestion ? <p className="mt-4 text-[13px] text-muted">{analysis.schedulingSuggestion}</p> : null}
            </div>
          ) : null}
          {posts.length ? (
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="ink">{posts.length} posts</Badge>
              {(Object.keys(counts) as PostStatus[]).map((s) => (
                <Badge key={s}>
                  {counts[s]} {STATUS_LABEL[s].toLowerCase()}
                </Badge>
              ))}
            </div>
          ) : null}
          <MissingInfo questions={analysis.missingInformation ?? []} />
        </div>
      </div>

      {story.status === "processing" && !posts.length ? (
        <Notice tone="info" title="Postory is still writing this story.">
          Refresh in a moment. If nothing appears, generate again below.
        </Notice>
      ) : null}

      {posts.length ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              ctx={{
                userId: user.id,
                timezone: tz,
                businessName: profile.business_name ?? profile.name ?? "Your business",
                accounts: (accounts ?? [])
                  .filter((a) => a.platform === post.platform)
                  .map((a) => ({ id: a.id, name: a.username ?? a.display_name ?? "Account" })),
                canPublish,
                aiEnabled: aiAvailable() && entitlements.active,
                factWarnings: (() => {
                  const unsupported = findUnsupportedNumbers(post.content, corpus, post.lastEditedBy === "user" ? post.content : "");
                  return unsupported.length ? [`Check ${unsupported.join(", ")} — not found in your story or business memory.`] : [];
                })(),
              }}
            />
          ))}
        </div>
      ) : (
        <GenerateForStory
          storyId={story.id}
          defaultPlatforms={Array.isArray(prefs?.defaultPlatforms) ? prefs.defaultPlatforms : []}
          enabled={aiAvailable() && entitlements.active}
          reason={!aiAvailable() ? "Post generation isn't configured yet." : "Generating posts needs a plan."}
        />
      )}
    </div>
  );
}
