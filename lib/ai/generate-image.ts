import "server-only";

import { generateImageBytes, type ImageShape } from "./llm";
import { imagePrompt } from "./prompts";

export async function generateImage(input: {
  story: string;
  post: string;
  suggestion: string | null;
  businessName: string | null;
  direction?: string;
  orientation: ImageShape;
}) {
  return generateImageBytes(imagePrompt({ ...input, extra: input.direction }), input.orientation);
}
