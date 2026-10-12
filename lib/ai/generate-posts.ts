import "server-only";

import { PLATFORM_META, countCharacters, type Platform } from "@/lib/social/platforms";
import { generateStructured, LlmError } from "./llm";
import { removeUnsupportedClaims } from "./claim-check";
import { findUnsupportedNumbers } from "./factuality";
import { GENERATE_SYSTEM, generateUserPrompt, type BusinessContext } from "./prompts";
import { ModelGeneration, ValidatedGeneration, type GenerationResult } from "./types";

export type GeneratedPostWithChecks = GenerationResult["posts"][number] & {
  warnings: string[];
};

/** Errors from the model layer, under the name the rest of the app uses. */
export { LlmError as GenerationError };

/** Validate model output and attach review warnings (unsupported numbers, length). */
export function checkGeneration(raw: unknown, platforms: Platform[], corpus: string, askWhenThin = false) {
  const parsed = ValidatedGeneration.safeParse(raw);
  if (!parsed.success) throw new LlmError("invalid_output", "The writer returned something Postory couldn't use. Try again.");

  // Too thin to write without guessing: hand the questions back instead of posts.
  if (parsed.data.needsMoreDetail && parsed.data.missingInformation.length) {
    if (!askWhenThin) {
      throw new LlmError("invalid_output", `Postory needs more detail about this story to write it without guessing. ${parsed.data.missingInformation[0]}`);
    }
    return { ...parsed.data, posts: [] as GeneratedPostWithChecks[], missingPlatforms: platforms, needsMoreDetail: true as const };
  }

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

  return { ...parsed.data, posts, missingPlatforms: platforms.filter((p) => !seen.has(p)), needsMoreDetail: false as const };
}

/**
 * `askWhenThin`: when the story is too vague to write without guessing, return
 * `needsMoreDetail` with questions instead of posts (new stories). Otherwise
 * that case is an error (rewrites of a story that already has posts).
 */
export async function generatePosts(input: { story: string; platforms: Platform[]; context: BusinessContext; corpus: string; angle?: string; askWhenThin?: boolean }) {
  const raw = await generateStructured({
    system: GENERATE_SYSTEM,
    turns: [{ role: "user", content: generateUserPrompt(input) }],
    schema: ModelGeneration,
    name: "story_posts",
  });
  const result = checkGeneration(raw, input.platforms, input.corpus, input.askWhenThin);
  if (result.needsMoreDetail || !result.posts.length) return result;
  // Second, independent read: strip specific claims the facts don't support.
  const checked = await removeUnsupportedClaims(result.posts, result.facts, input.corpus);
  return {
    ...result,
    posts: checked.map((post) => (post.content === result.posts.find((p) => p.platform === post.platform)?.content ? post : withWarnings(post, input.corpus))),
  };
}

/** Recompute review warnings for a post whose text changed. */
function withWarnings(post: GeneratedPostWithChecks, corpus: string): GeneratedPostWithChecks {
  const warnings: string[] = [];
  const unsupported = findUnsupportedNumbers(post.content, corpus);
  if (unsupported.length) warnings.push(`Check ${unsupported.join(", ")} — ${unsupported.length === 1 ? "it isn't" : "they aren't"} in your story or business memory.`);
  const length = countCharacters(post.content);
  const limit = PLATFORM_META[post.platform].charLimit;
  if (length > limit) warnings.push(`${length - limit} characters over the ${PLATFORM_META[post.platform].name} limit.`);
  return { ...post, warnings };
}
