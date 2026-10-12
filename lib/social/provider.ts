import "server-only";

import { integrations } from "@/lib/env";
import * as letmepost from "./letmepost";
import * as publora from "./publora";
import type { Platform } from "./platforms";
import type { ConnectDescriptor, ProviderAccount, ProviderPost, PublishRequest, PublishResult } from "./types";

/**
 * The social provider in use, behind one interface. Publora is preferred
 * when configured (each Postory user connects their own accounts through it);
 * LetMePost remains for deployments that use it.
 */
export type ProviderName = "publora" | "letmepost";

export type SocialProviderApi = {
  name: ProviderName;
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

const PUBLORA: SocialProviderApi = {
  name: "publora",
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
  if (integrations.publora()) return PUBLORA;
  if (integrations.letmepost()) return LETMEPOST;
  return null;
}
