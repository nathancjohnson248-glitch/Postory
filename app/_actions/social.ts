"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as social from "@/lib/social/service";
import { idSchema, platformSchema } from "@/lib/validation/schemas";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

const returnPathSchema = z.enum(["/onboarding", "/app/settings"]).catch("/app/settings");

export async function connectNetwork(platform: string, returnPath: string) {
  return runAction("social.connect", async (user) => {
    const parsed = platformSchema.safeParse(platform);
    if (!parsed.success) throw new UserFacingError("invalid_platform", "Unknown network.");
    const { attemptId, descriptor } = await social.startConnection(user.id, parsed.data, returnPathSchema.parse(returnPath));
    return descriptor.kind === "redirect"
      ? { kind: "redirect" as const, url: descriptor.url }
      : { kind: "credentials" as const, attemptId, fields: descriptor.fields };
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
