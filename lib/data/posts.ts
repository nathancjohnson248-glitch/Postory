import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, parseMedia } from "@/lib/posts/media";
import type { Platform } from "@/lib/social/platforms";
import type { PostStatus } from "@/lib/posts/state-machine";
import type { Tables } from "@/types/database";

export const POST_SELECT =
  "id,story_id,platform,content,generated_content,last_edited_by,angle,reasoning,media_suggestion,media,status,scheduled_for,published_at,external_url,error_code,error_message,version,social_account_id,updated_at,created_at,stories(id,title,source_text),social_accounts(id,display_name,username,status,profile_image_url)";

export type PostView = {
  id: string;
  storyId: string;
  storyTitle: string;
  storySource: string;
  platform: Platform;
  content: string;
  generatedContent: string | null;
  lastEditedBy: "ai" | "user";
  angle: string | null;
  reasoning: string | null;
  mediaSuggestion: string | null;
  media: { id: string; kind: "image" | "video"; url: string | null; altText?: string; source: "upload" | "ai" }[];
  status: PostStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  version: number;
  account: { id: string; name: string; displayName: string | null; handle: string | null; avatarUrl: string | null; status: string } | null;
  updatedAt: string;
  createdAt: string;
};

type Row = Pick<
  Tables<"story_posts">,
  | "id"
  | "story_id"
  | "platform"
  | "content"
  | "generated_content"
  | "last_edited_by"
  | "angle"
  | "reasoning"
  | "media_suggestion"
  | "media"
  | "status"
  | "scheduled_for"
  | "published_at"
  | "external_url"
  | "error_code"
  | "error_message"
  | "version"
  | "social_account_id"
  | "updated_at"
  | "created_at"
> & {
  stories: { id: string; title: string; source_text: string } | null;
  social_accounts: { id: string; display_name: string | null; username: string | null; status: string; profile_image_url: string | null } | null;
};

/** Convert rows to view models, signing media URLs in one batch. */
export async function toPostViews(rows: Row[]): Promise<PostView[]> {
  const supabase = await createClient();
  const paths = rows.flatMap((r) => parseMedia(r.media).map((m) => m.storagePath));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    storyId: r.story_id,
    storyTitle: r.stories?.title ?? "Untitled story",
    storySource: r.stories?.source_text ?? "",
    platform: r.platform as Platform,
    content: r.content,
    generatedContent: r.generated_content,
    lastEditedBy: r.last_edited_by === "user" ? "user" : "ai",
    angle: r.angle,
    reasoning: r.reasoning,
    mediaSuggestion: r.media_suggestion,
    media: parseMedia(r.media).map((m) => ({ id: m.id, kind: m.kind, url: signed.get(m.storagePath) ?? null, altText: m.altText, source: m.source })),
    status: r.status as PostStatus,
    scheduledFor: r.scheduled_for,
    publishedAt: r.published_at,
    externalUrl: r.external_url,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    version: r.version,
    account: r.social_accounts
      ? {
          id: r.social_accounts.id,
          name: r.social_accounts.username ?? r.social_accounts.display_name ?? "Account",
          displayName: r.social_accounts.display_name,
          handle: r.social_accounts.username,
          avatarUrl: r.social_accounts.profile_image_url,
          status: r.social_accounts.status,
        }
      : null,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  }));
}

export async function getStory(userId: string, storyId: string) {
  const supabase = await createClient();
  const [{ data: story }, { data: posts }] = await Promise.all([
    supabase.from("stories").select("*").eq("id", storyId).eq("user_id", userId).maybeSingle(),
    supabase.from("story_posts").select(POST_SELECT).eq("story_id", storyId).eq("user_id", userId).order("created_at"),
  ]);
  if (!story) return null;
  return { story, posts: await toPostViews((posts ?? []) as unknown as Row[]) };
}

export async function listPosts(
  userId: string,
  filter: { statuses?: PostStatus[]; scheduledFrom?: string; scheduledTo?: string; publishedFrom?: string; limit?: number; order?: "scheduled" | "updated" | "published" },
) {
  const supabase = await createClient();
  let query = supabase.from("story_posts").select(POST_SELECT).eq("user_id", userId);
  if (filter.statuses?.length) query = query.in("status", filter.statuses);
  if (filter.scheduledFrom) query = query.gte("scheduled_for", filter.scheduledFrom);
  if (filter.scheduledTo) query = query.lt("scheduled_for", filter.scheduledTo);
  if (filter.publishedFrom) query = query.gte("published_at", filter.publishedFrom);
  const column = filter.order === "scheduled" ? "scheduled_for" : filter.order === "published" ? "published_at" : "updated_at";
  query = query.order(column, { ascending: filter.order === "scheduled", nullsFirst: false }).limit(filter.limit ?? 50);
  const { data } = await query;
  return toPostViews((data ?? []) as unknown as Row[]);
}

/** Posts that belong on a calendar window: scheduled in it, or published in it. */
export async function listCalendarPosts(userId: string, fromIso: string, toIso: string) {
  const supabase = await createClient();
  const [{ data: scheduled }, { data: published }] = await Promise.all([
    supabase
      .from("story_posts")
      .select(POST_SELECT)
      .eq("user_id", userId)
      .in("status", ["scheduled", "publishing", "failed"])
      .gte("scheduled_for", fromIso)
      .lt("scheduled_for", toIso)
      .order("scheduled_for")
      .limit(400),
    supabase
      .from("story_posts")
      .select(POST_SELECT)
      .eq("user_id", userId)
      .eq("status", "published")
      .gte("published_at", fromIso)
      .lt("published_at", toIso)
      .order("published_at")
      .limit(400),
  ]);
  return toPostViews([...((scheduled ?? []) as unknown as Row[]), ...((published ?? []) as unknown as Row[])]);
}
