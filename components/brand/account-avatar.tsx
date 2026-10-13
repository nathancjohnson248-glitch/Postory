"use client";

import { useState } from "react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import type { Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/**
 * A connected account's real profile picture, with the network's icon as a
 * small badge so it's always clear where a post is going. Falls back to the
 * account's initial if the network didn't share a picture or the link expired.
 */
export function AccountAvatar({ src, name, platform, className, badge = true }: { src?: string | null; name?: string | null; platform: Platform; className?: string; badge?: boolean }) {
  const [broken, setBroken] = useState(false);
  const initial = (name ?? "").replace(/^@/, "").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={cn("relative inline-grid size-9 shrink-0", className)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars come from each network's CDN; next/image would need every host allow-listed
        <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full rounded-full object-cover ring-1 ring-line" />
      ) : (
        <span className="grid size-full place-items-center rounded-full bg-ink text-[0.8em] font-semibold text-white">{initial}</span>
      )}
      {badge ? (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-[45%] min-h-3.5 min-w-3.5 place-items-center rounded-full bg-surface ring-2 ring-surface">
          <PlatformIcon platform={platform} tile className="size-full rounded-full" />
        </span>
      ) : null}
    </span>
  );
}
