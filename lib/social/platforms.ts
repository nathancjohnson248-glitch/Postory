/**
 * Postory's network catalogue: limits, writing guidance, and what each
 * network's own API lets Postory do. Capabilities are deliberately
 * conservative: a feature is only on where the network's public API supports
 * it for an app like Postory, so the UI never promises more than it can do.
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
  /** How an account is connected: OAuth through Zernio, a Bluesky app password, or not at all. */
  connect: "oauth" | "app_password" | "none";
  /** What Postory can do with a connected account, per the network's API. */
  can: { publish: boolean; metrics: boolean; comments: boolean };
  /** Plain-language reason for anything above that's off. */
  limitation?: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  x: {
    id: "x",
    name: "X",
    charLimit: 280,
    mediaRequired: "none",
    voice: "Punchy and compressed. Lead with the most striking concrete detail. Lowercase is fine if it fits the brand. No hashtag stuffing; at most one if any.",
    connect: "oauth",
    can: { publish: true, metrics: true, comments: false },
    limitation: "X charges for every reply read, so X comments stay on X for now.",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    charLimit: 3000,
    mediaRequired: "none",
    voice: "First-person, reflective, professional without corporate filler. Short paragraphs with line breaks. Explain why it matters. A closing line that invites conversation is fine.",
    connect: "oauth",
    can: { publish: true, metrics: true, comments: true },
    limitation: "On personal profiles, LinkedIn shares stats only for posts published through Postory.",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    charLimit: 2200,
    mediaRequired: "image_or_video",
    voice: "Visual-first caption. A bold opening line, then a few short lines. Energetic but genuine. A few relevant hashtags at the end are acceptable.",
    note: "Instagram requires an image or video.",
    connect: "oauth",
    can: { publish: true, metrics: true, comments: true },
  },
  threads: {
    id: "threads",
    name: "Threads",
    charLimit: 500,
    mediaRequired: "none",
    voice: "Conversational and casual, like talking to people who already follow you. Short.",
    connect: "oauth",
    can: { publish: true, metrics: true, comments: true },
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    charLimit: 63206,
    mediaRequired: "none",
    voice: "Warm, community-oriented, plain language. A couple of short paragraphs.",
    connect: "oauth",
    can: { publish: true, metrics: true, comments: true },
  },
  bluesky: {
    id: "bluesky",
    name: "Bluesky",
    charLimit: 300,
    mediaRequired: "none",
    voice: "Candid and human, slightly nerdy. Short. No marketing speak.",
    connect: "app_password",
    can: { publish: true, metrics: true, comments: true },
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    charLimit: 500,
    mediaRequired: "image_or_video",
    voice: "Descriptive and searchable. Say what the image shows and why someone would save it.",
    note: "Every pin needs exactly one image or video.",
    connect: "oauth",
    can: { publish: true, metrics: true, comments: false },
    limitation: "Pinterest has no API for comments.",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    charLimit: 2200,
    mediaRequired: "video",
    voice: "Caption for a short video. Hooky first line, casual tone.",
    note: "TikTok needs a video, and the creator confirms the upload inside the TikTok app.",
    connect: "none",
    can: { publish: false, metrics: false, comments: false },
    limitation: "TikTok only lets apps it has audited publish to accounts. Postory writes the caption; you post the video from TikTok.",
  },
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** Grapheme-aware length, matching how the networks count. */
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
