import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PLATFORMS, type Platform } from "@/lib/social/platforms";

export type NetworkState = {
  platform: Platform;
  accounts: { id: string; displayName: string | null; username: string | null; status: string; connectedAt: string }[];
  lastError: string | null;
};

/** Connection state per network, from the database only. */
export async function getNetworkStates(userId: string): Promise<NetworkState[]> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: attempts }] = await Promise.all([
    supabase
      .from("social_accounts")
      .select("id,platform,display_name,username,status,connected_at")
      .eq("user_id", userId)
      .neq("status", "disconnected")
      .order("connected_at"),
    supabase
      .from("social_connection_attempts")
      .select("platform,status,error_message,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  return PLATFORMS.map((platform) => {
    const mine = (accounts ?? []).filter((a) => a.platform === platform);
    const latest = (attempts ?? []).find((a) => a.platform === platform);
    const newestConnect = mine.reduce((max, a) => (a.connected_at > max ? a.connected_at : max), "");
    const lastError = latest && latest.status === "failed" && latest.created_at > newestConnect ? latest.error_message : null;
    return {
      platform,
      accounts: mine.map((a) => ({
        id: a.id,
        displayName: a.display_name,
        username: a.username,
        status: a.status,
        connectedAt: a.connected_at,
      })),
      lastError,
    };
  });
}
