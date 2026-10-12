import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { GoogleBridge } from "@/components/auth/google-bridge";
import { env, integrations } from "@/lib/env";
import { safeNextPath } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Continue with Google", robots: { index: false } };

export default async function GooglePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const { next } = await searchParams;
  if (!integrations.privy()) redirect("/login?error=oauth");
  return <GoogleBridge appId={env.privyAppId()!} next={safeNextPath.parse(next ?? "/app")} />;
}
