import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkTextModel, LlmError } from "@/lib/ai/llm";
import { env } from "@/lib/env";

/**
 * Operational check: one tiny real request to the text model, so the owner
 * can confirm the AI works in production. Off unless AI_CHECK_TOKEN is set,
 * and answers 404 without the token.
 */
export async function POST(request: NextRequest) {
  const expected = env.aiCheckToken();
  const given = request.headers.get("x-postory-check-token") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    return NextResponse.json(await checkTextModel());
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof LlmError ? error.code : "error", message: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
