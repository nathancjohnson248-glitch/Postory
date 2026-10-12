"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as social from "@/lib/social/service";
import { idSchema, platformSchema } from "@/lib/validation/schemas";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

const returnPathSchema = z.enum(["/onboarding", "/app/connections"]).catch("/app/connections");

export async function connectNetwork(platform: string, returnPath: string) {
  return runAction("social.connect", async (user) => {
    const parsed = platformSchema.safeParse(platform);
    if (!parsed.success) throw new UserFacingError("invalid_platform", "Unknown network.");
    const { attemptId, descriptor } = await social.startConnection(user.id, parsed.data, returnPathSchema.parse(returnPath));
    if (descriptor.kind === "redirect") return { kind: "redirect" as const, url: descriptor.url, attemptId, newTab: Boolean(descriptor.newTab) };
    if (descriptor.kind === "session") return { kind: "session" as const, token: descriptor.token, attemptId };
    return { kind: "credentials" as const, attemptId, fields: descriptor.fields };
  });
}

/** After connecting in a new tab: ask the provider what's now connected. */
export async function finishConnection(attemptId: string) {
  return runAction("social.finish", async (user) => {
    const accounts = await social.completeConnection(user.id, idSchema.parse(attemptId), null);
    revalidatePath("/onboarding");
    revalidatePath("/app", "layout");
    return { connected: accounts.length };
  });
}

export async function submitNetworkCredentials(attemptId: string, fields: Record<string, string>) {
  return runAction("social.credentials", async (user) => {
    const id = idSchema.parse(attemptId);
    const clean = z.record(z.string().max(64), z.string().max(500)).parse(fields);
    const accounts = await social.completeCredentialsConnection(user.id, id, clean);
    revalidatePath("/onboarding");
    revalidatePath("/app", "layout");
    return { connected: accounts.length };
  });
}

export async function disconnectNetwork(socialAccountId: string) {
  return runAction("social.disconnect", async (user) => {
    const result = await social.disconnectAccount(user.id, idSchema.parse(socialAccountId));
    revalidatePath("/onboarding");
    revalidatePath("/app", "layout");
    return result;
  });
}

export async function syncNetworks() {
  return runAction("social.sync", async (user) => {
    const accounts = await social.syncAccounts(user.id);
    revalidatePath("/onboarding");
    revalidatePath("/app", "layout");
    return { count: accounts.length };
  });
}
