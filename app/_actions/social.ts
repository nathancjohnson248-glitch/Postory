"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as social from "@/lib/social/service";
import { idSchema, platformSchema } from "@/lib/validation/schemas";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

function refresh() {
  revalidatePath("/onboarding");
  revalidatePath("/app", "layout");
}

/** Start connecting: a Nango Connect UI token, or a request for Bluesky credentials. */
export async function connectNetwork(platform: string) {
  return runAction("social.connect", async (user) => {
    const parsed = platformSchema.safeParse(platform);
    if (!parsed.success) throw new UserFacingError("invalid_platform", "Unknown network.");
    return social.startConnection(user.id, parsed.data);
  });
}

/** Nango's Connect UI finished: ask Nango what's now connected. */
export async function finishConnection(attemptId: string) {
  return runAction("social.finish", async (user) => {
    const accounts = await social.completeConnection(user.id, idSchema.parse(attemptId));
    refresh();
    return { connected: accounts.length };
  });
}

const BlueskyInput = z.object({ identifier: z.string().trim().min(3).max(253), appPassword: z.string().trim().min(8).max(64) });

export async function connectBlueskyAccount(attemptId: string, input: { identifier: string; appPassword: string }) {
  return runAction("social.bluesky", async (user) => {
    const parsed = BlueskyInput.safeParse(input);
    if (!parsed.success) throw new UserFacingError("invalid", "Enter your Bluesky handle and an app password.");
    const accounts = await social.connectBluesky(user.id, idSchema.parse(attemptId), parsed.data);
    refresh();
    return { connected: accounts.length };
  });
}

export async function disconnectNetwork(socialAccountId: string) {
  return runAction("social.disconnect", async (user) => {
    const result = await social.disconnectAccount(user.id, idSchema.parse(socialAccountId));
    refresh();
    return result;
  });
}

export async function syncNetworks() {
  return runAction("social.sync", async (user) => {
    const accounts = await social.syncAccounts(user.id);
    refresh();
    return { count: accounts.length };
  });
}
