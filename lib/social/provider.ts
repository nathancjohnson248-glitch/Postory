import "server-only";

import { integrations } from "@/lib/env";
import * as letmepost from "./letmepost";
import * as nango from "./nango";
import * as postiz from "./postiz";
import * as publishers from "./publishers";
import * as publora from "./publora";
import type { Platform } from "./platforms";
import type { ConnectDescriptor, ProviderAccount, ProviderPost, PublishRequest, PublishResult } from "./types";

/**
 * The social provider in use, behind one interface. Publora is preferred
 * when configured (each Postory user connects their own accounts through it);
 * LetMePost remains for deployments that use it.
 */
export type ProviderName = "nango" | "postiz" | "publora" | "letmepost";

export type SocialProviderApi = {
  name: ProviderName;
  /**
   * One workspace holds every customer's channels (Postiz). Postory then
   * records which channel belongs to whom; otherwise each user has their own.
   */
  sharedWorkspace?: boolean;
  /** Networks that can be connected through this provider; omitted means all. */
  platforms?: Platform[];
  /** Moves a scheduled post in place. Without it, Postory replaces the post. */
  canReschedule?: boolean;
  /** Networks set up right now, when that's only known at runtime (Nango integrations). */
  availablePlatforms?: () => Promise<Platform[]>;
  /** The provider only publishes; Postory's own scheduler sends scheduled posts at their time. */
  schedulesLocally?: boolean;
  /** How media reaches the provider: uploaded by Postory, or fetched by the provider from short-lived URLs. */
  media: "upload" | "urls";
  /** Whether a scheduled post may carry media. */
  schedulesMedia: boolean;
  listAccounts(workspaceId: string): Promise<ProviderAccount[]>;
  startConnect(platform: Platform, input: { profileId: string; returnTo: string }): Promise<ConnectDescriptor>;
  completeCredentialsConnect(platform: Platform, input: { profileId: string; fields: Record<string, string> }): Promise<unknown>;
  disconnectAccount(id: string): Promise<void>;
  uploadMedia(input: { bytes: ArrayBuffer; filename: string; contentType: string; profileId: string }): Promise<{ mediaId: string }>;
  createPost(input: PublishRequest): Promise<PublishResult>;
  getPost(id: string, workspaceId: string): Promise<ProviderPost>;
  reschedulePost(id: string, when: Date, workspaceId: string): Promise<unknown>;
  cancelPost(id: string, workspaceId: string): Promise<void>;
};

const unsupported = async (): Promise<never> => {
  throw new Error("Not supported by this provider.");
};

/** Nango holds the tokens; Postory posts through each network's own API and schedules itself. */
const NANGO: SocialProviderApi = {
  name: "nango",
  canReschedule: true,
  schedulesLocally: true,
  availablePlatforms: () => nango.availablePlatforms(),
  media: "urls",
  schedulesMedia: true,
  listAccounts: async (userId) => {
    const connections = await nango.listConnections(userId);
    return Promise.all(
      connections.map(async (c): Promise<ProviderAccount> => {
        const target = { connectionId: c.connectionId, providerConfigKey: c.providerConfigKey };
        const who = c.broken ? null : await publishers.profile(c.platform, target).catch(() => null);
        return {
          externalId: nango.packAccountId(target),
          platform: c.platform,
          displayName: who?.username ? `@${who.username}` : (who?.name ?? null),
          externalProfileId: userId,
          platformAccountId: who?.id ?? c.connectionId,
          tokenExpiresAt: null,
          needsReconnect: c.broken || who === null,
          metadata: { name: who?.name ?? null, username: who?.username ?? null, picture: who?.avatar ?? null, nangoProvider: c.provider },
        };
      }),
    );
  },
  startConnect: async (platform, input) => {
    const token = await nango.connectSessionToken(input.profileId, platform);
    return token ? { kind: "session", token, availability: "stable" } : { kind: "redirect", url: "", availability: "pending" };
  },
  completeCredentialsConnect: unsupported,
  disconnectAccount: (id) => {
    const t = nango.unpackAccountId(id);
    return nango.deleteConnection(t.connectionId, t.providerConfigKey);
  },
  uploadMedia: unsupported,
  createPost: async (input) => {
    const published = await publishers.publish(input.platform, nango.unpackAccountId(input.accountExternalId), input.text, input.mediaUrls?.[0] ?? null);
    return { status: "published", externalPostId: published.postId, platformPostId: published.postId, batchId: null, uri: published.url, warnings: [], error: null };
  },
  getPost: unsupported,
  // Scheduling is Postory's own, so there's nothing to move or cancel at the provider.
  reschedulePost: async () => undefined,
  cancelPost: async () => undefined,
};

const POSTIZ: SocialProviderApi = {
  name: "postiz",
  sharedWorkspace: true,
  platforms: postiz.POSTIZ_PLATFORMS,
  canReschedule: false,
  media: "urls",
  schedulesMedia: true,
  listAccounts: () => postiz.listAccounts(),
  startConnect: (platform) => postiz.startConnect(platform),
  completeCredentialsConnect: unsupported,
  disconnectAccount: (id) => postiz.disconnectAccount(id),
  uploadMedia: unsupported,
  createPost: (input) => postiz.createPost(input),
  getPost: (id) => postiz.getPost(id),
  reschedulePost: unsupported,
  cancelPost: (id) => postiz.cancelPost(id),
};

const PUBLORA: SocialProviderApi = {
  name: "publora",
  canReschedule: true,
  media: "urls",
  schedulesMedia: true,
  listAccounts: (workspaceId) => publora.listAccounts(workspaceId),
  startConnect: (platform, input) => publora.startConnect(platform, input),
  completeCredentialsConnect: unsupported,
  disconnectAccount: () => publora.disconnectAccount(),
  uploadMedia: unsupported,
  createPost: (input) => publora.createPost(input),
  getPost: (id, workspaceId) => publora.getPost(id, workspaceId),
  reschedulePost: (id, when, workspaceId) => publora.reschedulePost(id, when, workspaceId),
  cancelPost: (id, workspaceId) => publora.cancelPost(id, workspaceId),
};

const LETMEPOST: SocialProviderApi = {
  name: "letmepost",
  canReschedule: true,
  media: "upload",
  // LetMePost accepts text-only scheduled posts.
  schedulesMedia: false,
  listAccounts: (workspaceId) => letmepost.listAccounts(workspaceId),
  startConnect: (platform, input) => letmepost.startConnect(platform, input),
  completeCredentialsConnect: (platform, input) => letmepost.completeCredentialsConnect(platform, input),
  disconnectAccount: (id) => letmepost.disconnectAccount(id),
  uploadMedia: (input) => letmepost.uploadMedia(input),
  createPost: (input) => letmepost.createPost(input),
  getPost: (id) => letmepost.getPost(id),
  reschedulePost: (id, when) => letmepost.reschedulePost(id, when),
  cancelPost: (id) => letmepost.cancelPost(id),
};

export function activeProvider(): SocialProviderApi | null {
  if (integrations.nango()) return NANGO;
  if (integrations.postiz()) return POSTIZ;
  if (integrations.publora()) return PUBLORA;
  if (integrations.letmepost()) return LETMEPOST;
  return null;
}
