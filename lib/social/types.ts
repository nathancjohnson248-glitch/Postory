import type { Platform } from "./platforms";

/** Shapes the rest of Postory works with, whichever way an account is connected. */

/** "nango" for OAuth connections held by Nango; "bluesky" for app-password connections. */
export type ConnectionKind = "nango" | "bluesky";

export type ProviderAccount = {
  externalId: string;
  platform: Platform;
  displayName: string | null;
  platformAccountId: string;
  /** The connection can't publish until it's reconnected. */
  needsReconnect?: boolean;
  metadata: Record<string, unknown>;
};

export type Published = { postId: string; url: string | null };

/** Engagement on one published post. null = the network doesn't report that number. */
export type PostMetrics = { impressions: number | null; reach: number | null; reactions: number | null; comments: number | null; reposts: number | null };

/** One comment or reply on a post Postory published. */
export type RemoteComment = {
  id: string;
  authorName: string | null;
  authorHandle: string | null;
  text: string;
  createdAt: string;
  url: string | null;
  /** Whatever the network needs to reply to it later (e.g. Bluesky's root/parent refs). */
  context: Record<string, unknown>;
};

export class SocialProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly options: {
      status?: number;
      remediation?: string;
      platform?: string;
      /** The network may or may not have acted (timeout, 5xx). */
      outcomeUnknown?: boolean;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "SocialProviderError";
  }

  get status() {
    return this.options.status;
  }
}
