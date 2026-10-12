import "server-only";

import { PLATFORM_META, countCharacters, type Platform } from "@/lib/social/platforms";
import { generateStructured, LlmError } from "./llm";
import { findUnsupportedNumbers } from "./factuality";
import { GENERATE_SYSTEM, generateUserPrompt, type BusinessContext } from "./prompts";
import { ModelGeneration, ValidatedGeneration, type GenerationResult } from "./types";

export type GeneratedPostWithChecks = GenerationResult["posts"][number] & {
  warnings: string[];
};

/** Errors from the model layer, under the name the rest of the app uses. */
export { LlmError as GenerationError };

/** Validate model output and attach review warnings (unsupported numbers, length). */
export function checkGeneration(raw: unknown, platforms: Platform[], corpus: string) {
  const parsed = ValidatedGeneration.safeParse(raw);
  if (!parsed.success) throw new LlmError("invalid_output", "The writer returned something Postory couldn't use. Try again.");

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
  if (posts.length === 0) throw new LlmError("invalid_output", "The writer didn't produce posts for the networks you chose. Try again.");

  return { ...parsed.data, posts, missingPlatforms: platforms.filter((p) => !seen.has(p)) };
}

export async function generatePosts(input: { story: string; platforms: Platform[]; context: BusinessContext; corpus: string; angle?: string }) {
  const raw = await generateStructured({
    system: GENERATE_SYSTEM,
    turns: [{ role: "user", content: generateUserPrompt(input) }],
    schema: ModelGeneration,
    name: "story_posts",
  });
  return checkGeneration(raw, input.platforms, input.corpus);
}
