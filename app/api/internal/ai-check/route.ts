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
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof LlmError ? error.code : "error",
        message: error instanceof Error ? error.message : "failed",
        baseUrl: env.githubModelsBaseUrl(),
        model: env.githubModelsFastModel(),
        // Which models this token can use, to fix a wrong model id quickly.
        catalog: await catalog(),
      },
      { status: 502 },
    );
  }
}

async function catalog() {
  try {
    const res = await fetch("https://models.github.ai/catalog/models", {
      headers: { Authorization: `Bearer ${env.githubModelsToken()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return { status: res.status };
    const rows = (await res.json()) as { id: string; rate_limit_tier?: string }[];
    return rows.filter((m) => /llama|gpt-4\.1|gpt-5|deepseek/i.test(m.id)).map((m) => `${m.id} (${m.rate_limit_tier ?? "?"})`);
  } catch (error) {
    return { error: error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : "failed" };
  }
}
