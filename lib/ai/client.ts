import "server-only";

import { llmProvider } from "./llm";

/** Whether Postory's AI (Replicate) is configured. */
export function aiAvailable() {
  return llmProvider() !== null;
}
