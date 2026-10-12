import "server-only";

import { integrations } from "@/lib/env";
import * as letmepost from "./letmepost";
import * as postiz from "./postiz";
import * as publora from "./publora";
import type { Platform } from "./platforms";
import type { ConnectDescriptor, ProviderAccount, ProviderPost, PublishRequest, PublishResult } from "./types";

/**
 * The social provider in use, behind one interface. Publora is preferred
 * when configured (each Postory user connects their own accounts through it);
 * LetMePost remains for deployments that use it.
 */
export type ProviderName = "postiz" | "publora" | "letmepost";

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
  if (integrations.postiz()) return POSTIZ;
  if (integrations.publora()) return PUBLORA;
  if (integrations.letmepost()) return LETMEPOST;
  return null;
}
