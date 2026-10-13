import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Secrets a network needs that Nango can't hold for us (a Bluesky app
 * password). Encrypted with AES-256-GCM under CREDENTIALS_KEY before they
 * reach the database, and stored in a table only the server can read.
 */

function key() {
  const raw = env.credentialsKey();
  if (!raw) return null;
  const bytes = Buffer.from(raw, "base64");
  return bytes.length === 32 ? bytes : null;
}

export function credentialsAvailable() {
  return key() !== null;
}

function encrypt(plain: string) {
  const k = key();
  if (!k) throw new Error("CREDENTIALS_KEY is not configured.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

function decrypt(sealed: string) {
  const k = key();
  if (!k) throw new Error("CREDENTIALS_KEY is not configured.");
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable credential.");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export async function saveCredential(userId: string, socialAccountId: string, secret: Record<string, string>) {
  const { error } = await createAdminClient()
    .from("social_credentials")
    .upsert({ social_account_id: socialAccountId, user_id: userId, secret: encrypt(JSON.stringify(secret)) });
  if (error) throw new Error("Could not store the connection.");
}

export async function readCredential(userId: string, socialAccountId: string): Promise<Record<string, string> | null> {
  const { data } = await createAdminClient()
    .from("social_credentials")
    .select("secret")
    .eq("social_account_id", socialAccountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  try {
    return JSON.parse(decrypt(data.secret)) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function deleteCredential(userId: string, socialAccountId: string) {
  await createAdminClient().from("social_credentials").delete().eq("social_account_id", socialAccountId).eq("user_id", userId);
}
