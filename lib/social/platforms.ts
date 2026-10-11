/**
 * Postory's network catalogue. Mirrors the platforms LetMePost publishes to
 * (see https://api.letmepost.dev OpenAPI `Platform` enum). Limits come from
 * LetMePost's documented preflight rules so Postory warns before the provider
 * rejects a post.
 *
 * Safe to import from client and server code — contains no secrets.
 */

export const PLATFORMS = ["x", "linkedin", "instagram", "threads", "facebook", "bluesky", "pinterest", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type PlatformMeta = {
  id: Platform;
  name: string;
  /** Maximum post length in user-perceived characters (graphemes). */
  charLimit: number;
  /** Platform refuses text-only posts. */
  mediaRequired: "none" | "image_or_video" | "video";
  /** Style guidance handed to the writer model. */
  voice: string;
  /** Extra caveat the UI should surface. */
  note?: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  x: {
    id: "x",
    name: "X",
    charLimit: 280,
    mediaRequired: "none",
    voice: "Punchy and compressed. Lead with the most striking concrete detail. Lowercase is fine if it fits the brand. No hashtag stuffing; at most one if any.",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    charLimit: 3000,
    mediaRequired: "none",
    voice: "First-person, reflective, professional without corporate filler. Short paragraphs with line breaks. Explain why it matters. A closing line that invites conversation is fine.",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    charLimit: 2200,
    mediaRequired: "image_or_video",
    voice: "Visual-first caption. A bold opening line, then a few short lines. Energetic but genuine. A few relevant hashtags at the end are acceptable.",
    note: "Instagram requires an image or video.",
  },
  threads: {
    id: "threads",
    name: "Threads",
    charLimit: 500,
    mediaRequired: "none",
    voice: "Conversational and casual, like talking to people who already follow you. Short.",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    charLimit: 63206,
    mediaRequired: "none",
    voice: "Warm, community-oriented, plain language. A couple of short paragraphs.",
  },
  bluesky: {
    id: "bluesky",
    name: "Bluesky",
    charLimit: 300,
    mediaRequired: "none",
    voice: "Candid and human, slightly nerdy. Short. No marketing speak.",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    charLimit: 500,
    mediaRequired: "image_or_video",
    voice: "Descriptive and searchable. Say what the image shows and why someone would save it.",
    note: "Every pin needs exactly one image or video.",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    charLimit: 2200,
    mediaRequired: "video",
    voice: "Caption for a short video. Hooky first line, casual tone.",
    note: "TikTok needs a video, and the creator confirms the upload inside the TikTok app.",
  },
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** Grapheme-aware length, matching how LetMePost and the networks count. */
export function countCharacters(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text)).length;
  }
  return Array.from(text).length;
}

export type ContentIssue = { level: "error" | "warning"; message: string };

export function validatePostContent(
  platform: Platform,
  content: string,
  media: { kind: "image" | "video" }[] = [],
): ContentIssue[] {
  const meta = PLATFORM_META[platform];
  const issues: ContentIssue[] = [];
  const length = countCharacters(content.trim());

  if (length === 0 && meta.mediaRequired === "none") {
    issues.push({ level: "error", message: `${meta.name} posts need text.` });
  }
  if (length > meta.charLimit) {
    issues.push({ level: "error", message: `${length - meta.charLimit} characters over ${meta.name}'s ${meta.charLimit.toLocaleString()} limit.` });
  }
  if (meta.mediaRequired === "image_or_video" && media.length === 0) {
    issues.push({ level: "error", message: `${meta.name} requires an image or video.` });
  }
  if (meta.mediaRequired === "video" && !media.some((m) => m.kind === "video")) {
    issues.push({ level: "error", message: `${meta.name} requires a video.` });
  }
  if (platform === "pinterest" && media.length > 1) {
    issues.push({ level: "error", message: "Pinterest pins carry exactly one image or video." });
  }
  return issues;
}
