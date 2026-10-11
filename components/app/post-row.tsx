import Link from "next/link";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostStatusBadge } from "@/components/product/status-badge";
import { PLATFORM_META } from "@/lib/social/platforms";
import type { PostView } from "@/lib/data/posts";
import { truncate } from "@/lib/utils";

/** Compact post line used on Home, Library and the calendar agenda. */
export function PostRow({ post, when }: { post: PostView; when?: string | null }) {
  return (
    <Link
      href={`/app/library/${post.storyId}#post-${post.id}`}
      className="group flex items-start gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-wash"
    >
      <PlatformIcon platform={post.platform} tile className="mt-0.5 size-8 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-ink">{post.storyTitle}</p>
          <span className="text-xs text-faint">· {PLATFORM_META[post.platform].name}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-muted">{truncate(post.content.replace(/\s+/g, " "), 160)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <PostStatusBadge status={post.status} />
        {when ? <span className="text-xs text-faint">{when}</span> : null}
      </div>
    </Link>
  );
}
