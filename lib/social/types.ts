import type { Platform } from "./platforms";

/** Provider-neutral shapes the rest of Postory works with. */

export type ProviderAccount = {
  externalId: string;
  platform: Platform;
  displayName: string | null;
  externalProfileId: string | null;
  platformAccountId: string;
  tokenExpiresAt: string | null;
  /** The provider says this connection can't publish until it's reconnected. */
  needsReconnect?: boolean;
  metadata: Record<string, unknown>;
};

export type ConnectDescriptor =
  | { kind: "redirect"; url: string; availability: "stable" | "trial" | "pending"; newTab?: boolean }
  | { kind: "credentials"; fields: { name: string; label: string; type: string }[]; availability: "stable" | "trial" | "pending" };

export type ProviderMedia = { kind: "image" | "video"; mediaId: string; altText?: string };

export type PublishRequest = {
  accountExternalId: string;
  platform: Platform;
  text: string;
  media: ProviderMedia[];
  scheduledAt?: Date;
  externalProfileId?: string | null;
  idempotencyKey: string;
  /** Short-lived public URLs, for providers that fetch media themselves. */
  mediaUrls?: string[];
  /** The provider's own name for the connected account type (e.g. Postiz "linkedin-page"). */
  providerHint?: string;
};

export type ProviderPostStatus = "queued" | "validated" | "publishing" | "published" | "failed" | "rejected" | "canceled";

export type PublishResult = {
  status: ProviderPostStatus;
  externalPostId: string | null;
  platformPostId?: string | null;
  batchId: string | null;
  uri: string | null;
  warnings: string[];
  error: { code: string; message: string; remediation?: string; rule?: string } | null;
};

export type ProviderPost = {
  externalPostId: string;
  /** The network's own id for the post, when the provider reports it. */
  platformPostId?: string | null;
  status: ProviderPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  uri: string | null;
  error: { code: string; message: string } | null;
};

export class SocialProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly options: {
      status?: number;
      rule?: string;
      remediation?: string;
      requestId?: string;
      platform?: string;
      /** The provider may or may not have acted (timeout, 5xx). */
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
