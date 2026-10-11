import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { PLATFORM_META, countCharacters, type Platform } from "@/lib/social/platforms";
import { getOpenAI, models } from "./client";
import { findUnsupportedNumbers } from "./factuality";
import { GENERATE_SYSTEM, generateUserPrompt, type BusinessContext } from "./prompts";
import { ModelGeneration, ValidatedGeneration, type GenerationResult } from "./types";

export type GeneratedPostWithChecks = GenerationResult["posts"][number] & {
  warnings: string[];
};

export class GenerationError extends Error {
  constructor(public readonly code: "invalid_output" | "refused" | "provider_error", message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** Validate model output and attach review warnings (unsupported numbers, length). */
export function checkGeneration(raw: unknown, platforms: Platform[], corpus: string) {
  const parsed = ValidatedGeneration.safeParse(raw);
  if (!parsed.success) throw new GenerationError("invalid_output", "The writer returned something Postory couldn't use. Try again.");

  const wanted = new Set(platforms);
  const seen = new Set<Platform>();
  const posts: GeneratedPostWithChecks[] = [];
  for (const post of parsed.data.posts) {
    if (!wanted.has(post.platform) || seen.has(post.platform)) continue;
    seen.add(post.platform);
    const warnings: string[] = [];
    const unsupported = findUnsupportedNumbers(post.content, corpus);
    if (unsupported.length) {
      warnings.push(`Check ${unsupported.join(", ")} — ${unsupported.length === 1 ? "it isn't" : "they aren't"} in your story or business memory.`);
    }
    const length = countCharacters(post.content);
    const limit = PLATFORM_META[post.platform].charLimit;
    if (length > limit) warnings.push(`${length - limit} characters over the ${PLATFORM_META[post.platform].name} limit.`);
    posts.push({ ...post, warnings });
  }
  if (posts.length === 0) throw new GenerationError("invalid_output", "The writer didn't produce posts for the networks you chose. Try again.");

  return { ...parsed.data, posts, missingPlatforms: platforms.filter((p) => !seen.has(p)) };
}

export async function generatePosts(input: { story: string; platforms: Platform[]; context: BusinessContext; corpus: string }) {
  const openai = getOpenAI();
  let response;
  try {
    response = await openai.responses.parse({
      model: models.text(),
      input: [
        { role: "system", content: GENERATE_SYSTEM },
        { role: "user", content: generateUserPrompt(input) },
      ],
      text: { format: zodTextFormat(ModelGeneration, "story_posts") },
    });
  } catch (error) {
    throw new GenerationError("provider_error", error instanceof Error ? error.message : "OpenAI request failed.");
  }
  if (!response.output_parsed) throw new GenerationError("refused", "The writer declined this request. Rephrase the story and try again.");
  return checkGeneration(response.output_parsed, input.platforms, input.corpus);
}
