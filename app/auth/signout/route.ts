import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/http/public-url";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirectTo(request, "/login", undefined, 303);
}

export const POST = signOut;
export const GET = signOut;
